import { Prisma } from "@/generated/prisma/client";
import { LOCAL_ACTOR, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { dateKeyInKarachi } from "@/lib/dates";
import { formatPaisa } from "@/lib/format";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";
import { outstandingPaisa } from "@/modules/customers/balance";

import {
  matchesSalePreview,
  priceSale,
  SalePricingError,
  type SalePreview,
} from "./pricing";
import type { SaleWithItems } from "./queries";
import { createSaleSchema, voidSaleSchema } from "./schema";

/** An error whose message is safe and useful to show the shopkeeper. */
class ServiceError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function handleError(error: unknown): Result<never> {
  if (error instanceof SalePricingError) {
    return fail(error.message, error.fieldErrors);
  }

  if (error instanceof ServiceError) {
    return fail(error.message, error.fieldErrors);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return fail("The sale could not be saved. Please try again.");
  }

  console.error("Sales service error:", error);
  return fail("Something went wrong while saving the sale. Please try again.");
}

/** Next receipt number for the shop's day, for example 20261025-0003. */
async function nextSaleNumber(
  tx: Prisma.TransactionClient,
  shopId: string,
  now: Date,
): Promise<string> {
  const prefix = dateKeyInKarachi(now);
  const count = await tx.sale.count({
    where: { shopId, number: { startsWith: `${prefix}-` } },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Record a sale.
 *
 * One transaction re-reads each product, rejects missing, inactive, or
 * insufficient stock, snapshots price and cost, creates the sale and its
 * lines, decrements stock, and writes a SALE stock movement per line
 * (invariants 2, 3, 5, 6). Nothing is written when any check fails.
 *
 * `createSaleWithStatus` also reports whether an assistant proposal was
 * already confirmed, so a replayed confirmation is idempotent. `createSale`
 * keeps the simple sell-screen contract.
 * Everything is scoped to `shopId`.
 */
export type CreateSaleOptions = {
  /** Set only when confirming an assistant proposal. */
  proposalId?: string;
  /** The preview the shopkeeper confirmed; the write must match it. */
  expectedPreview?: SalePreview;
};

export type CreateSaleOutcome = {
  sale: SaleWithItems;
  alreadyConfirmed: boolean;
};

export async function createSaleWithStatus(
  shopId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
  options: CreateSaleOptions = {},
): Promise<Result<CreateSaleOutcome>> {
  const parsed = createSaleSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please check the sale details.", fieldErrors(parsed.error));
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // A replayed confirmation returns the sale that already exists.
      if (options.proposalId) {
        const existing = await tx.sale.findUnique({
          where: { proposalId: options.proposalId },
          include: {
            items: { orderBy: { position: "asc" } },
            customer: { select: { id: true, name: true, phone: true } },
          },
        });

        if (existing) {
          return { sale: existing, alreadyConfirmed: true };
        }
      }

      const priced = await priceSale(tx, shopId, parsed.data);

      if (
        options.expectedPreview &&
        !matchesSalePreview(priced, options.expectedPreview)
      ) {
        throw new SalePricingError(
          "Prices or stock changed since this proposal was prepared. Ask the assistant to prepare it again.",
        );
      }

      const khataBalanceBeforePaisa =
        priced.paymentMethod === "CREDIT" && priced.customerId
          ? await outstandingPaisa(tx, shopId, priced.customerId)
          : null;

      const now = new Date();
      const number = await nextSaleNumber(tx, shopId, now);

      const created = await tx.sale.create({
        data: {
          number,
          proposalId: options.proposalId ?? null,
          totalPaisa: priced.totalPaisa,
          discountPaisa: priced.discountPaisa,
          paidPaisa: priced.paidPaisa,
          changePaisa: priced.changePaisa,
          paymentMethod: priced.paymentMethod,
          customerId: priced.customerId,
          shopId,
          note: priced.note,
          items: {
            create: priced.lines.map((line) => ({
              productId: line.productId,
              position: line.position,
              productName: line.productName,
              unit: line.unit,
              quantityMilli: line.quantityMilli,
              unitPricePaisa: line.unitPricePaisa,
              unitCostPaisa: line.unitCostPaisa,
              lineTotalPaisa: line.lineTotalPaisa,
              lineCostPaisa: line.lineCostPaisa,
            })),
          },
        },
        include: {
          items: { orderBy: { position: "asc" } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      for (const line of priced.lines) {
        await tx.product.update({
          where: { id: line.productId, shopId },
          data: { stockMilli: { decrement: line.quantityMilli } },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            shopId,
            quantityMilli: -line.quantityMilli,
            reason: "SALE",
            reference: created.id,
          },
        });
      }

      const stockChanges = priced.lines.map((line) => ({
        productId: line.productId,
        quantityMilli: line.quantityMilli,
        stockBeforeMilli: line.stockBeforeMilli,
        stockAfterMilli: line.stockBeforeMilli - line.quantityMilli,
      }));

      const khataBalanceAfterPaisa =
        priced.paymentMethod === "CREDIT" && priced.customerId
          ? await outstandingPaisa(tx, shopId, priced.customerId)
          : null;

      await writeAudit(tx, {
        actor,
        shopId,
        action: "SALE_CREATED",
        entityType: "Sale",
        entityId: created.id,
        summary: `Sale ${created.number} · ${formatPaisa(created.totalPaisa)}`,
        before: null,
        after: {
          number: created.number,
          proposalId: created.proposalId,
          totalPaisa: created.totalPaisa,
          discountPaisa: created.discountPaisa,
          paidPaisa: created.paidPaisa,
          changePaisa: created.changePaisa,
          paymentMethod: created.paymentMethod,
          customerId: created.customerId,
          khataBalanceBeforePaisa,
          khataBalanceAfterPaisa,
        },
        details: {
          itemCount: priced.lines.length,
          stockChanges,
          source: options.proposalId ? "assistant_proposal" : "sell_screen",
        },
      });

      return { sale: created, alreadyConfirmed: false };
    });

    return ok(outcome);
  } catch (error) {
    // A concurrent confirmation may win the unique proposal index.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      options.proposalId
    ) {
      const existing = await prisma.sale.findUnique({
        where: { proposalId: options.proposalId },
        include: {
          items: { orderBy: { position: "asc" } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      if (existing) {
        return ok({ sale: existing, alreadyConfirmed: true });
      }
    }

    return handleError(error);
  }
}

/** Record a sale from the sell screen. */
export async function createSale(
  shopId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<SaleWithItems>> {
  const result = await createSaleWithStatus(shopId, input, actor);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.sale);
}

/**
 * Void a sale: restore its stock and mark it voided, never edit it.
 *
 * One transaction restores every line with a VOID stock movement, sets
 * `voidedAt` / `voidedReason`, and writes an audit entry. Credit balances are
 * derived, so excluding the voided sale restores the customer's balance. A
 * credit sale that already has repayments applied cannot be voided, because
 * removing its unpaid amount would leave the customer owed money by the shop.
 * Everything is scoped to `shopId`.
 */
export async function voidSale(
  shopId: string,
  saleId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<SaleWithItems>> {
  const parsed = voidSaleSchema.safeParse(input);

  if (!parsed.success) {
    return fail(
      "Please give a reason for voiding this sale.",
      fieldErrors(parsed.error),
    );
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id: saleId, shopId },
        include: { items: true },
      });

      if (!existing) {
        throw new ServiceError("Sale not found.");
      }

      if (existing.voidedAt) {
        throw new ServiceError("This sale is already voided.");
      }

      let khataBalanceBeforePaisa: number | null = null;

      if (existing.paymentMethod === "CREDIT" && existing.customerId) {
        const outstanding = await outstandingPaisa(
          tx,
          shopId,
          existing.customerId,
        );
        const unpaidPaisa = existing.totalPaisa - existing.paidPaisa;

        if (outstanding < unpaidPaisa) {
          throw new ServiceError(
            "This credit sale has repayments applied, so voiding it would make the khata balance negative. Refunds are not supported yet.",
          );
        }

        khataBalanceBeforePaisa = outstanding;
      }

      const products = await tx.product.findMany({
        where: {
          id: { in: existing.items.map((item) => item.productId) },
          shopId,
        },
      });
      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );
      const stockChanges = existing.items.map((item) => {
        const product = productsById.get(item.productId);
        const stockBeforeMilli = product?.stockMilli ?? 0;

        return {
          productId: item.productId,
          quantityMilli: item.quantityMilli,
          stockBeforeMilli,
          stockAfterMilli: stockBeforeMilli + item.quantityMilli,
        };
      });

      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId, shopId },
          data: { stockMilli: { increment: item.quantityMilli } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            shopId,
            quantityMilli: item.quantityMilli,
            reason: "VOID",
            reference: existing.id,
            note: parsed.data.reason,
          },
        });
      }

      const voidedAt = new Date();

      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          voidedAt,
          voidedReason: parsed.data.reason,
        },
        include: {
          items: { orderBy: { position: "asc" } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      const khataBalanceAfterPaisa =
        existing.paymentMethod === "CREDIT" && existing.customerId
          ? await outstandingPaisa(tx, shopId, existing.customerId)
          : null;

      await writeAudit(tx, {
        actor,
        shopId,
        action: "SALE_VOIDED",
        entityType: "Sale",
        entityId: existing.id,
        summary: `Voided sale ${existing.number} · ${formatPaisa(existing.totalPaisa)}`,
        before: {
          voidedAt: null,
          totalPaisa: existing.totalPaisa,
          paidPaisa: existing.paidPaisa,
          khataBalancePaisa: khataBalanceBeforePaisa,
        },
        after: {
          voidedAt: voidedAt.toISOString(),
          voidedReason: parsed.data.reason,
          totalPaisa: existing.totalPaisa,
          khataBalancePaisa: khataBalanceAfterPaisa,
        },
        details: {
          number: existing.number,
          stockChanges,
        },
      });

      return updated;
    });

    return ok(sale);
  } catch (error) {
    return handleError(error);
  }
}
