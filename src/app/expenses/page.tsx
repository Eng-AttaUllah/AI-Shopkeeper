import Link from "next/link";

import { createExpenseAction } from "@/app/expenses/actions";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { StatCard } from "@/components/reports/stat-card";
import { buttonVariants } from "@/components/ui/button";
import {
  isoDateKeyInKarachi,
  karachiMonthRange,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate, formatMonthYear, formatPaisa } from "@/lib/format";
import { expenseTotalPaisa, listExpenses } from "@/modules/expenses/queries";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/modules/expenses/schema";

export const dynamic = "force-dynamic";

function categoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

export default async function ExpensesPage() {
  const now = new Date();
  const todayKey = isoDateKeyInKarachi(now);
  const monthRange = karachiMonthRange(now);

  const [expenses, monthTotal] = await Promise.all([
    listExpenses(50),
    expenseTotalPaisa(prisma, monthRange),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Money paid out for the shop. Expenses reduce net profit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/reports"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            Reports
          </Link>
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <section aria-label="Expense summary" className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="This month"
          value={formatPaisa(monthTotal)}
          hint={formatMonthYear(now)}
        />
        <StatCard
          label="Expenses listed"
          value={String(expenses.length)}
          hint="Last 50 records"
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Record an expense</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Rent, bills, salaries, transport, and other shop costs.
        </p>
        <div className="mt-4">
          <ExpenseForm action={createExpenseAction} today={todayKey} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Recent expenses</h2>
            <p className="text-sm text-ink-muted">Newest first.</p>
          </div>
          <p className="text-sm text-ink-muted">
            {expenses.length}{" "}
            {expenses.length === 1 ? "expense" : "expenses"}
          </p>
        </div>

        {expenses.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-line p-6 text-center">
            <p className="font-medium">No expenses recorded yet.</p>
            <p className="mt-1 text-sm text-ink-muted">
              Use the form above when you pay for something for the shop.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">
                    {categoryLabel(expense.category)}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {formatDate(expense.spentAt)}
                    {expense.note ? ` · ${expense.note}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums">
                  {formatPaisa(expense.amountPaisa)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
