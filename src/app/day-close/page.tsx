import Link from "next/link";

import { recordCashCheckAction } from "@/app/day-close/actions";
import { CashCheckForm } from "@/components/cash/cash-check-form";
import { buttonVariants } from "@/components/ui/button";
import {
  isoDateKeyInKarachi,
  karachiDayRange,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate, formatPaisa } from "@/lib/format";
import { cashBreakdown, listReconciliations } from "@/modules/cash/queries";

export const dynamic = "force-dynamic";

export default async function DayClosePage() {
  const now = new Date();
  const todayKey = isoDateKeyInKarachi(now);
  const todayRange = karachiDayRange(now);

  const [breakdown, history] = await Promise.all([
    cashBreakdown(prisma, todayRange),
    listReconciliations(14),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Day close</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Count the cash in the drawer and compare it with what the app
            expects.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/expenses"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            Expenses
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

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Expected cash today</h2>
            <p className="text-sm text-ink-muted">{formatDate(now)}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatPaisa(breakdown.expectedPaisa)}
          </p>
        </div>

        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Cash sales</dt>
            <dd className="tabular-nums">
              {formatPaisa(breakdown.cashSalesPaisa)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Cash paid on credit sales</dt>
            <dd className="tabular-nums">
              {formatPaisa(breakdown.creditCashPaisa)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Repayments received</dt>
            <dd className="tabular-nums">
              {formatPaisa(breakdown.repaymentsPaisa)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Expenses paid from the drawer</dt>
            <dd className="tabular-nums">
              − {formatPaisa(breakdown.expensesPaisa)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-ink-muted">
          Expected cash is cash sales, cash paid at the counter on credit sales,
          and repayments, minus expenses. Voided sales are excluded. A cash
          refund for a voided sale is not recorded; note it when you count.
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Save a cash check</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Re-running a day updates its saved check.
        </p>
        <div className="mt-4">
          <CashCheckForm action={recordCashCheckAction} today={todayKey} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Recent cash checks</h2>
        <p className="mt-1 text-sm text-ink-muted">
          The last 14 saved days, newest first.
        </p>

        {history.length === 0 ? (
          <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
            No cash checks saved yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.map((check) => (
              <li
                key={check.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{formatDate(check.businessDate)}</p>
                  <p className="text-sm text-ink-muted">
                    Expected {formatPaisa(check.expectedPaisa)} · Counted{" "}
                    {formatPaisa(check.countedPaisa)}
                  </p>
                  {check.note ? (
                    <p className="text-sm text-ink-muted">{check.note}</p>
                  ) : null}
                </div>
                <p
                  className={`shrink-0 font-medium tabular-nums ${
                    check.differencePaisa === 0
                      ? "text-success"
                      : "text-error"
                  }`}
                >
                  {check.differencePaisa === 0
                    ? "Balanced"
                    : formatPaisa(check.differencePaisa)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
