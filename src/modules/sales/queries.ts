import type { Sale, SaleItem } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type SaleCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

export type SaleWithItems = Sale & {
  items: SaleItem[];
  customer: SaleCustomer | null;
};

/** Recent sales, newest first, with the number of lines in each. */
export async function listSales(
  shopId: string,
  take = 50,
) {
  return prisma.sale.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      _count: { select: { items: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}

/** One sale with its lines in receipt order and the credit customer. */
export async function getSale(
  shopId: string,
  id: string,
): Promise<SaleWithItems | null> {
  return prisma.sale.findFirst({
    where: { id, shopId },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
}

/** Sum of the line totals before the sale-level discount. */
export function saleSubtotalPaisa(sale: SaleWithItems): number {
  return sale.items.reduce((total, item) => total + item.lineTotalPaisa, 0);
}

/** Gross profit using the cost snapshots, never a product's current cost. */
export function saleProfitPaisa(sale: SaleWithItems): number {
  return (
    sale.items.reduce(
      (total, item) => total + item.lineTotalPaisa - item.lineCostPaisa,
      0,
    ) - sale.discountPaisa
  );
}
