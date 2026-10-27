import { Prisma } from "@/generated/prisma/client";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { dateKeyInKarachi } from "@/lib/dates";
import { formatPaisa } from "@/lib/format";
import { multiplyPaisa, rupeesToPaisa } from "@/lib/money";
import { formatQuantity, fromMilli, toMilli } from "@/lib/quantity";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";
import { outstandingPaisa } from "@/modules/customers/balance";

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

type SaleLineInput = {
  productId: string;
  position: number;
  productName: string;
  unit: string;
  quantityMilli: number;
  unitPricePaisa: number;
  unitCostPaisa: number;
  lineTotalPaisa: number;
  lineCostPaisa: number;
};

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function handleError(error: unknown): Result<never> {
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
  now: Date,
): Promise<string> {
  const prefix = dateKeyInKarachi(now);
  const count = await tx.sale.count({
    where: { number: { startsWith: `${prefix}-` } },
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
 */
export async function createSale(
  input: unknown,
): Promise<Result<SaleWithItems>> {
  const parsed = createSaleSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please check the sale details.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  // Merge duplicate lines so stock is checked once per product.
  const requestedMilli = new Map<string, number>();

  for (const item of data.items) {
    const quantityMilli = toMilli(item.quantity);

    if (quantityMilli <= 0) {
      return fail("Every quantity must be more than zero.", {
        items: "Quantity must be more than zero",
      });
    }

    requestedMilli.set(
      item.productId,
      (requestedMilli.get(item.productId) ?? 0) + quantityMilli,
    );
  }

  const discountPaisa = rupeesToPaisa(data.discount);
  const paidInput = data.paid?.trim();
  const isCredit = data.paymentMethod === "CREDIT";
  const customerId = data.customerId ?? null;

  if (isCredit && !customerId) {
    return fail("Choose a customer for a credit sale.", {
      customerId: "Required",
    });
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      let khataBalanceBeforePaisa: number | null = null;

      if (isCredit && customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new ServiceError("Customer not found.");
        }

        khataBalanceBeforePaisa = await outstandingPaisa(tx, customerId);
      }

      const products = await tx.product.findMany({
        where: { id: { in: [...requestedMilli.keys()] } },
      });
      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );

      let subtotalPaisa = 0;
      let position = 0;
      const lines: SaleLineInput[] = [];

      for (const [productId, quantityMilli] of requestedMilli) {
        const product = productsById.get(productId);

        if (!product) {
          throw new ServiceError("One of the products no longer exists.");
        }

        if (!product.isActive) {
          throw new ServiceError(`${product.name} is not on sale.`);
        }

        if (quantityMilli > product.stockMilli) {
          throw new ServiceError(
            `Only ${formatQuantity(product.stockMilli, product.unit)} of ${product.name} in stock.`,
          );
        }

        const quantity = fromMilli(quantityMilli);
        const lineTotalPaisa = multiplyPaisa(product.salePricePaisa, quantity);
        const lineCostPaisa = multiplyPaisa(product.costPricePaisa, quantity);

        subtotalPaisa += lineTotalPaisa;
        lines.push({
          productId,
          position,
          productName: product.name,
          unit: product.unit,
          quantityMilli,
          unitPricePaisa: product.salePricePaisa,
          unitCostPaisa: product.costPricePaisa,
          lineTotalPaisa,
          lineCostPaisa,
        });
        position += 1;
      }

      if (discountPaisa > subtotalPaisa) {
        throw new ServiceError("The discount is more than the sale total.", {
          discount: "More than the total",
        });
      }

      const totalPaisa = subtotalPaisa - discountPaisa;
      const paidPaisa = paidInput
        ? rupeesToPaisa(paidInput)
        : isCredit
          ? 0
          : totalPaisa;

      if (isCredit) {
        if (paidPaisa > totalPaisa) {
          throw new ServiceError(
            "Cash received is more than the total. Record a cash sale instead.",
            { paid: "More than the total" },
          );
        }
      } else if (paidPaisa < totalPaisa) {
        throw new ServiceError("Cash received is less than the total.", {
          paid: "Less than the total",
        });
      }

      const now = new Date();
      const number = await nextSaleNumber(tx, now);

      const created = await tx.sale.create({
        data: {
          number,
          totalPaisa,
          discountPaisa,
          paidPaisa,
          changePaisa: isCredit ? 0 : paidPaisa - totalPaisa,
          paymentMethod: data.paymentMethod,
          customerId: isCredit ? customerId : null,
          note: emptyToNull(data.note),
          items: { create: lines },
        },
        include: {
          items: { orderBy: { position: "asc" } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stockMilli: { decrement: line.quantityMilli } },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            quantityMilli: -line.quantityMilli,
            reason: "SALE",
            reference: created.id,
          },
        });
      }

      const stockChanges = lines.map((line) => {
        const product = productsById.get(line.productId);
        const stockBeforeMilli = product?.stockMilli ?? 0;

        return {
          productId: line.productId,
          quantityMilli: line.quantityMilli,
          stockBeforeMilli,
          stockAfterMilli: stockBeforeMilli - line.quantityMilli,
        };
      });

      const khataBalanceAfterPaisa =
        isCredit && customerId
          ? await outstandingPaisa(tx, customerId)
          : null;

      await writeAudit(tx, {
        action: "SALE_CREATED",
        entityType: "Sale",
        entityId: created.id,
        summary: `Sale ${created.number} · ${formatPaisa(created.totalPaisa)}`,
        before: null,
        after: {
          number: created.number,
          totalPaisa: created.totalPaisa,
          discountPaisa: created.discountPaisa,
          paidPaisa: created.paidPaisa,
          changePaisa: created.changePaisa,
          paymentMethod: created.paymentMethod,
          customerId: created.customerId,
          khataBalanceBeforePaisa,
          khataBalanceAfterPaisa,
        },
        details: { itemCount: lines.length, stockChanges },
      });

      return created;
    });

    return ok(sale);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Void a sale: restore its stock and mark it voided, never edit it.
 *
 * One transaction restores every line with a VOID stock movement, sets
 * `voidedAt` / `voidedReason`, and writes an audit entry. Credit balances are
 * derived, so excluding the voided sale restores the customer's balance. A
 * credit sale that already has repayments applied cannot be voided, because
 * removing its unpaid amount would leave the customer owed money by the shop.
 */
export async function voidSale(
  saleId: string,
  input: unknown,
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
      const existing = await tx.sale.findUnique({
        where: { id: saleId },
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
        const outstanding = await outstandingPaisa(tx, existing.customerId);
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
          where: { id: item.productId },
          data: { stockMilli: { increment: item.quantityMilli } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
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
          ? await outstandingPaisa(tx, existing.customerId)
          : null;

      await writeAudit(tx, {
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
