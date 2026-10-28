import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DateRange } from "@/lib/dates";
import { sumPaisa } from "@/lib/money";

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

export type ExpenseCategoryTotal = {
  category: string;
  amountPaisa: number;
};

export type ExpenseSummary = {
  totalPaisa: number;
  categories: ExpenseCategoryTotal[];
};

/** Expense totals grouped by category for a half-open shop-local range. */
export async function expenseSummaryByCategory(
  range: DateRange,
): Promise<ExpenseSummary> {
  const groups = await prisma.expense.groupBy({
    by: ["category"],
    where: { spentAt: { gte: range.start, lt: range.end } },
    _sum: { amountPaisa: true },
  });

  const categories = groups
    .map((group) => ({
      category: group.category,
      amountPaisa: group._sum.amountPaisa ?? 0,
    }))
    .sort(
      (a, b) =>
        b.amountPaisa - a.amountPaisa ||
        a.category.localeCompare(b.category),
    );

  return {
    totalPaisa: sumPaisa(categories.map((row) => row.amountPaisa)),
    categories,
  };
}
