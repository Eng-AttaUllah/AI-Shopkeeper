import type { Sale, SaleItem } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type SaleWithItems = Sale & { items: SaleItem[] };

/** Recent sales, newest first, with the number of lines in each. */
export async function listSales(take = 50) {
  return prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { _count: { select: { items: true } } },
  });
}

/** One sale with its lines in receipt order. */
export async function getSale(id: string): Promise<SaleWithItems | null> {
  return prisma.sale.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
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
