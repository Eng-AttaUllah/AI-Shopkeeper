import type { Prisma } from "@/generated/prisma/client";
import { multiplyPaisa, rupeesToPaisa } from "@/lib/money";
import { formatQuantity, fromMilli, toMilli } from "@/lib/quantity";
import { z } from "zod";

import type { CreateSaleInput } from "./schema";

/**
 * Price a sale without writing anything.
 *
 * The sell screen, the assistant's sale proposal, and the final write all use
 * this function, so a proposal cannot drift from what is actually recorded.
 * Stock and prices are read from the product rows; the client never supplies
 * them. See `docs/architecture.md`, invariants 2, 3, and 5.
 */

export type PricedSaleLine = {
  productId: string;
  position: number;
  productName: string;
  unit: string;
  quantityMilli: number;
  unitPricePaisa: number;
  unitCostPaisa: number;
  lineTotalPaisa: number;
  lineCostPaisa: number;
  /** Stock before this sale, used for the audit entry. */
  stockBeforeMilli: number;
};

export type PricedSaleCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

export type PricedSale = {
  paymentMethod: "CASH" | "CREDIT";
  customerId: string | null;
  customer: PricedSaleCustomer | null;
  note: string | null;
  lines: PricedSaleLine[];
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  changePaisa: number;
};

/** A customer-facing preview, without cost or stock details. */
export const salePreviewLineSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  unit: z.string().min(1),
  quantityMilli: z.number().int().nonnegative(),
  unitPricePaisa: z.number().int().nonnegative(),
  lineTotalPaisa: z.number().int().nonnegative(),
});

export const salePreviewSchema = z.object({
  paymentMethod: z.enum(["CASH", "CREDIT"]),
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
  note: z.string().nullable(),
  lines: z.array(salePreviewLineSchema).min(1).max(50),
  subtotalPaisa: z.number().int().nonnegative(),
  discountPaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
  paidPaisa: z.number().int().nonnegative(),
  changePaisa: z.number().int().nonnegative(),
});

export type SalePreview = z.infer<typeof salePreviewSchema>;
export type SalePreviewLine = z.infer<typeof salePreviewLineSchema>;

/** An error whose message is safe to show the shopkeeper. */
export class SalePricingError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "SalePricingError";
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseMoney(value: string, field: string): number {
  try {
    return rupeesToPaisa(value);
  } catch {
    throw new SalePricingError(`Enter a valid amount for ${field}.`, {
      [field]: "Invalid amount",
    });
  }
}

/**
 * Read products and customers, apply the sale rules, and return the exact
 * lines and totals that a write would use. Throws `SalePricingError` for any
 * condition the shopkeeper can correct.
 */
export async function priceSale(
  db: Prisma.TransactionClient,
  data: CreateSaleInput,
): Promise<PricedSale> {
  // Merge duplicate lines so stock is checked once per product.
  const requestedMilli = new Map<string, number>();

  for (const item of data.items) {
    let quantityMilli: number;

    try {
      quantityMilli = toMilli(item.quantity);
    } catch {
      throw new SalePricingError("Enter a valid quantity.", {
        items: "Invalid quantity",
      });
    }

    if (quantityMilli <= 0) {
      throw new SalePricingError("Every quantity must be more than zero.", {
        items: "Quantity must be more than zero",
      });
    }

    requestedMilli.set(
      item.productId,
      (requestedMilli.get(item.productId) ?? 0) + quantityMilli,
    );
  }

  const discountPaisa = parseMoney(data.discount, "discount");
  const isCredit = data.paymentMethod === "CREDIT";
  const customerId = data.customerId ?? null;

  let customer: PricedSaleCustomer | null = null;

  if (isCredit) {
    if (!customerId) {
      throw new SalePricingError("Choose a customer for a credit sale.", {
        customerId: "Required",
      });
    }

    const found = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, phone: true },
    });

    if (!found) {
      throw new SalePricingError("Customer not found.");
    }

    customer = found;
  }

  const products = await db.product.findMany({
    where: { id: { in: [...requestedMilli.keys()] } },
  });
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );

  let subtotalPaisa = 0;
  let position = 0;
  const lines: PricedSaleLine[] = [];

  for (const [productId, quantityMilli] of requestedMilli) {
    const product = productsById.get(productId);

    if (!product) {
      throw new SalePricingError("One of the products no longer exists.");
    }

    if (!product.isActive) {
      throw new SalePricingError(`${product.name} is not on sale.`);
    }

    if (quantityMilli > product.stockMilli) {
      throw new SalePricingError(
        `Only ${formatQuantity(product.stockMilli, product.unit)} of ${product.name} in stock.`,
      );
    }

    const quantity = fromMilli(quantityMilli);
    let lineTotalPaisa: number;
    let lineCostPaisa: number;

    try {
      lineTotalPaisa = multiplyPaisa(product.salePricePaisa, quantity);
      lineCostPaisa = multiplyPaisa(product.costPricePaisa, quantity);
    } catch {
      throw new SalePricingError("The sale total is too large.");
    }

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
      stockBeforeMilli: product.stockMilli,
    });
    position += 1;
  }

  if (discountPaisa > subtotalPaisa) {
    throw new SalePricingError("The discount is more than the sale total.", {
      discount: "More than the total",
    });
  }

  const totalPaisa = subtotalPaisa - discountPaisa;
  const paidInput = data.paid?.trim();
  const paidPaisa = paidInput
    ? parseMoney(paidInput, "paid")
    : isCredit
      ? 0
      : totalPaisa;

  if (isCredit) {
    if (paidPaisa > totalPaisa) {
      throw new SalePricingError(
        "Cash received is more than the total. Record a cash sale instead.",
        { paid: "More than the total" },
      );
    }
  } else if (paidPaisa < totalPaisa) {
    throw new SalePricingError("Cash received is less than the total.", {
      paid: "Less than the total",
    });
  }

  return {
    paymentMethod: data.paymentMethod,
    customerId: isCredit ? customerId : null,
    customer: isCredit ? customer : null,
    note: emptyToNull(data.note),
    lines,
    subtotalPaisa,
    discountPaisa,
    totalPaisa,
    paidPaisa,
    changePaisa: isCredit ? 0 : paidPaisa - totalPaisa,
  };
}

/** Strip cost and stock details from a priced sale for display or signing. */
export function toSalePreview(priced: PricedSale): SalePreview {
  return {
    paymentMethod: priced.paymentMethod,
    customerId: priced.customerId,
    customerName: priced.customer?.name ?? null,
    note: priced.note,
    lines: priced.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      unit: line.unit,
      quantityMilli: line.quantityMilli,
      unitPricePaisa: line.unitPricePaisa,
      lineTotalPaisa: line.lineTotalPaisa,
    })),
    subtotalPaisa: priced.subtotalPaisa,
    discountPaisa: priced.discountPaisa,
    totalPaisa: priced.totalPaisa,
    paidPaisa: priced.paidPaisa,
    changePaisa: priced.changePaisa,
  };
}

/**
 * True when the current price and stock checks produce exactly the preview the
 * shopkeeper confirmed. Any difference means the proposal is stale.
 */
export function matchesSalePreview(
  priced: PricedSale,
  preview: SalePreview,
): boolean {
  if (
    priced.paymentMethod !== preview.paymentMethod ||
    priced.customerId !== preview.customerId ||
    (priced.customer?.name ?? null) !== preview.customerName ||
    priced.note !== preview.note ||
    priced.discountPaisa !== preview.discountPaisa ||
    priced.subtotalPaisa !== preview.subtotalPaisa ||
    priced.totalPaisa !== preview.totalPaisa ||
    priced.paidPaisa !== preview.paidPaisa ||
    priced.changePaisa !== preview.changePaisa ||
    priced.lines.length !== preview.lines.length
  ) {
    return false;
  }

  return priced.lines.every((line, index) => {
    const expected = preview.lines[index];

    return (
      expected !== undefined &&
      line.productId === expected.productId &&
      line.productName === expected.productName &&
      line.unit === expected.unit &&
      line.quantityMilli === expected.quantityMilli &&
      line.unitPricePaisa === expected.unitPricePaisa &&
      line.lineTotalPaisa === expected.lineTotalPaisa
    );
  });
}
