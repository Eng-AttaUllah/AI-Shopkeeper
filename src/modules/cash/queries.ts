import type { Prisma } from "@/generated/prisma/client";
import type { DateRange } from "@/lib/dates";
import { prisma } from "@/lib/db";

/**
 * Expected cash for one shop day.
 *
 * Cash sales contribute their total (cash received minus change), credit sales
 * contribute the cash paid at the counter, repayments add cash in, and expenses
 * are assumed to be paid from the drawer. Voided sales are excluded.
 */
export type CashBreakdown = {
  cashSalesPaisa: number;
  creditCashPaisa: number;
  repaymentsPaisa: number;
  expensesPaisa: number;
  expectedPaisa: number;
};

export async function cashBreakdown(
  db: Prisma.TransactionClient,
  range: DateRange,
  shopId: string,
): Promise<CashBreakdown> {
  const createdAt = { gte: range.start, lt: range.end };

  const [cashSales, creditSales, repayments, expenses] = await Promise.all([
    db.sale.aggregate({
      where: { shopId, voidedAt: null, paymentMethod: "CASH", createdAt },
      _sum: { totalPaisa: true },
    }),
    db.sale.aggregate({
      where: { shopId, voidedAt: null, paymentMethod: "CREDIT", createdAt },
      _sum: { paidPaisa: true },
    }),
    db.payment.aggregate({
      where: { shopId, createdAt },
      _sum: { amountPaisa: true },
    }),
    db.expense.aggregate({
      where: { shopId, spentAt: createdAt },
      _sum: { amountPaisa: true },
    }),
  ]);

  const cashSalesPaisa = cashSales._sum.totalPaisa ?? 0;
  const creditCashPaisa = creditSales._sum.paidPaisa ?? 0;
  const repaymentsPaisa = repayments._sum.amountPaisa ?? 0;
  const expensesPaisa = expenses._sum.amountPaisa ?? 0;

  return {
    cashSalesPaisa,
    creditCashPaisa,
    repaymentsPaisa,
    expensesPaisa,
    expectedPaisa:
      cashSalesPaisa + creditCashPaisa + repaymentsPaisa - expensesPaisa,
  };
}

/** Recent cash checks, newest day first. */
export async function listReconciliations(
  shopId: string,
  take = 14,
) {
  return prisma.cashReconciliation.findMany({
    where: { shopId },
    orderBy: { businessDate: "desc" },
    take,
  });
}

/** The saved cash check for one shop day, if any. */
export async function getReconciliation(
  shopId: string,
  businessDate: Date,
) {
  return prisma.cashReconciliation.findFirst({
    where: { shopId, businessDate },
  });
}
