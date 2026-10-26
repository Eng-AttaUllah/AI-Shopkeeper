import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dateKeyInKarachi } from "@/lib/dates";
import { multiplyPaisa, rupeesToPaisa } from "@/lib/money";
import { formatQuantity, fromMilli, toMilli } from "@/lib/quantity";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import type { SaleWithItems } from "./queries";
import { createSaleSchema } from "./schema";

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
      if (isCredit && customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new ServiceError("Customer not found.");
        }
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

      return created;
    });

    return ok(sale);
  } catch (error) {
    return handleError(error);
  }
}
