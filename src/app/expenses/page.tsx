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
import { readClientLocale, translate } from "@/lib/dictionary";
import { expenseTotalPaisa, listExpenses } from "@/modules/expenses/queries";

export const dynamic = "force-dynamic";

function categoryLabel(category: string, t: (key: string) => string): string {
  return t(`expense.category.${category}`) ?? category;
}

export default async function ExpensesPage() {
  const now = new Date();
  const todayKey = isoDateKeyInKarachi(now);
  const monthRange = karachiMonthRange(now);

  const [expenses, monthTotal] = await Promise.all([
    listExpenses(50),
    expenseTotalPaisa(prisma, monthRange),
  ]);

  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const categoryT = (category: string) => categoryLabel(category, t);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{await t("page.expenses")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("expenses.moneyPaidOut")}
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
            {await t("nav.reports")}
          </Link>
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            {await t("nav.dashboard")}
          </Link>
        </div>
      </header>

      <section aria-label="Expense summary" className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label={t("reports.thisMonthShort")}
          value={formatPaisa(monthTotal)}
          hint={formatMonthYear(now)}
        />
        <StatCard
          label={t("expenses.expensesListed")}
          value={String(expenses.length)}
          hint={t("expenses.last50Records")}
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("expenses.recordExpense")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("expenses.expenseTypes")}
        </p>
        <div className="mt-4">
          <ExpenseForm
            today={todayKey}
            action={createExpenseAction}
            t={t}
            categoryT={categoryT}
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{t("expenses.recentExpenses")}</h2>
            <p className="text-sm text-ink-muted">{t("expenses.newestFirst")}</p>
          </div>
          <p className="text-sm text-ink-muted">
            {expenses.length}{" "}
            {expenses.length === 1 ? t("reports.product") : t("reports.items")}
          </p>
        </div>

        {expenses.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-line p-6 text-center">
            <p className="font-medium">{t("expenses.noExpensesYet")}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {t("expenses.useForm")}
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
                  <p className="font-medium">{categoryT(expense.category)}</p>
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
