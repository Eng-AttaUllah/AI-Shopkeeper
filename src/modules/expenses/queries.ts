import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DateRange } from "@/lib/dates";

/** Recent expenses, newest first. */
export async function listExpenses(take = 50) {
  return prisma.expense.findMany({
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    take,
  });
}

/** Total expenses recorded in a half-open shop-local range. */
export async function expenseTotalPaisa(
  db: Prisma.TransactionClient,
  range: DateRange,
): Promise<number> {
  const result = await db.expense.aggregate({
    where: { spentAt: { gte: range.start, lt: range.end } },
    _sum: { amountPaisa: true },
  });

  return result._sum.amountPaisa ?? 0;
}
