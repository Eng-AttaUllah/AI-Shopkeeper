import type { Prisma } from "@/generated/prisma/client";

/**
 * Outstanding balance for one customer: unpaid amounts on non-voided credit
 * sales minus recorded payments. The balance is always derived, never stored.
 *
 * Accepts a transaction client so a sale or a payment can check the balance
 * inside the same transaction that writes it (invariant 2).
 */
export async function outstandingPaisa(
  db: Prisma.TransactionClient,
  shopId: string,
  customerId: string,
): Promise<number> {
  const sales = await db.sale.findMany({
    where: { customerId, shopId, paymentMethod: "CREDIT", voidedAt: null },
    select: { totalPaisa: true, paidPaisa: true },
  });

  const payments = await db.payment.aggregate({
    where: { customerId, shopId },
    _sum: { amountPaisa: true },
  });

  const duePaisa = sales.reduce(
    (total, sale) => total + sale.totalPaisa - sale.paidPaisa,
    0,
  );

  return duePaisa - (payments._sum.amountPaisa ?? 0);
}
