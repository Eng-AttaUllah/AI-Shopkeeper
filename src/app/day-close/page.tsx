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
import { readClientLocale, translate } from "@/lib/dictionary";
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

  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{await t("page.dayClose")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dayClose.countCash")}
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
            {await t("nav.expenses")}
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

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {t("dayClose.expectedCashToday")}
            </h2>
            <p className="text-sm text-ink-muted">{formatDate(now)}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatPaisa(breakdown.expectedPaisa)}
          </p>
        </div>

        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("dayClose.cashSales")}</dt>
            <dd className="tabular-nums">
              {formatPaisa(breakdown.cashSalesPaisa)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("dayClose.cashPaidCreditSales")}</dt>
            <dd className="tabular-nums">
              {formatPaisa(breakdown.creditCashPaisa)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("dayClose.repaymentsReceived")}</dt>
            <dd className="tabular-nums">
              {formatPaisa(breakdown.repaymentsPaisa)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("dayClose.expensesDrawer")}</dt>
            <dd className="tabular-nums">
              − {formatPaisa(breakdown.expensesPaisa)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-ink-muted">
          {t("dayClose.expectedCashNote")}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("dayClose.saveCashCheck")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("dayClose.rerunUpdates")}
        </p>
        <div className="mt-4">
          <CashCheckForm
            action={recordCashCheckAction}
            today={todayKey}
            t={t}
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("dayClose.recentChecks")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("dayClose.last14Days")}
        </p>

        {history.length === 0 ? (
          <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
            {t("dayClose.noChecksYet")}
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
                    {t("dayClose.expected")} {formatPaisa(check.expectedPaisa)} · {t("dayClose.counted")} {formatPaisa(check.countedPaisa)}
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
                    ? t("dayClose.balanced")
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
