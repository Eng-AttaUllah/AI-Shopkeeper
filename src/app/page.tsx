import Link from "next/link";

import { SalesBarChart } from "@/components/reports/sales-bar-chart";
import { StatCard } from "@/components/reports/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ensureDailyBackup } from "@/lib/backup";
import {
  addKarachiDays,
  karachiDayRange,
  startOfKarachiDay,
  startOfKarachiMonth,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import { readClientLocale, translate } from "@/lib/dictionary";
import {
  inventoryValuePaisa,
  lowStockProducts,
} from "@/modules/products/queries";
import {
  creditOverview,
  periodSummary,
  salesSeries,
  salesSummary,
} from "@/modules/reports/queries";
import { listSales } from "@/modules/sales/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const todayRange = karachiDayRange(now);
  const monthRange = {
    start: startOfKarachiMonth(now),
    end: todayRange.end,
  };
  const seriesRange = {
    start: startOfKarachiDay(addKarachiDays(now, -13)),
    end: todayRange.end,
  };

  await ensureDailyBackup().catch((error) => {
    console.error("Daily backup failed:", error);
  });

  const [
    shop,
    today,
    month,
    series,
    credit,
    lowStock,
    stockValue,
    recentSales,
  ] = await Promise.all([
    prisma.shop.findFirst({ orderBy: { createdAt: "asc" } }),
    salesSummary(todayRange),
    periodSummary(monthRange),
    salesSeries(seriesRange),
    creditOverview(5),
    lowStockProducts(),
    inventoryValuePaisa(),
    listSales(5),
  ]);

  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            {shop?.name ?? t("dashboard.yourShop")} · {formatDate(now)}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            {await t("page.dashboard")}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t("dashboard.thisMonth")}:{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.revenuePaisa)}
            </span>{" "}
            {t("dashboard.revenue")} ·{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.profitPaisa)}
            </span>{" "}
            {t("dashboard.grossProfit")} ·{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.expensePaisa)}
            </span>{" "}
            {t("dashboard.expenses")} ·{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.netProfitPaisa)}
            </span>{" "}
            {t("dashboard.netProfit")} ·{" "}
            <span className="font-medium text-ink">{month.salesCount}</span>{" "}
            {month.salesCount === 1 ? t("dashboard.sale") : t("dashboard.sales")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/sell"
            className={buttonVariants({ className: "h-11 px-4 text-base" })}
          >
            {t("dashboard.startSale")}
          </Link>
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
            href="/assistant"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            {t("dashboard.askAssistant")}
          </Link>
          <Link
            href="/day-close"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            {t("dashboard.dayClose")}
          </Link>
        </div>
      </header>

      <section aria-label={t("dashboard.today")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.todayRevenue")}
          value={formatPaisa(today.revenuePaisa)}
          hint={`${today.salesCount} ${
            today.salesCount === 1 ? t("dashboard.sale") : t("dashboard.sales")
          }`}
          accent="money"
        />
        <StatCard
          label={t("dashboard.todayProfit")}
          value={formatPaisa(today.profitPaisa)}
          hint={`${t("dashboard.beforeExpenses")} ${formatPaisa(today.costPaisa)}`}
        />
        <StatCard
          label={t("dashboard.creditGivenToday")}
          value={formatPaisa(today.creditGivenPaisa)}
          hint={t("dashboard.newKhata")}
          tone={today.creditGivenPaisa > 0 ? "error" : "default"}
        />
        <StatCard
          label={t("dashboard.outstandingCredit")}
          value={formatPaisa(credit.totalPaisa)}
          hint={
            credit.customerCount === 0
              ? t("dashboard.noOneOwes")
              : `${credit.customerCount} ${
                  credit.customerCount === 1
                    ? t("dashboard.customerOwes")
                    : t("dashboard.customersOwe")
                }`
          }
          tone={credit.totalPaisa > 0 ? "error" : "default"}
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {t("dashboard.salesLast14Days")}
            </h2>
            <p className="text-sm text-ink-muted">
              {t("dashboard.dailyRevenue")}
            </p>
          </div>
          <Link
            href="/reports?period=month"
            className="text-sm font-medium text-brand hover:text-brand-hover"
          >
            {t("dashboard.monthlyReport")}
          </Link>
        </div>

        <div className="mt-4">
          <SalesBarChart
            points={series.points}
            label="Daily revenue for the last 14 days"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("dashboard.recentSales")}</h2>
            <Link
              href="/sales"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              {t("dashboard.viewAll")}
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
              {t("dashboard.noSalesYet")}{" "}
              <Link href="/sell" className="text-brand underline">
                {t("dashboard.startSale")}
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recentSales.map((sale) => (
                <li
                  key={sale.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">
                      <Link
                        href={`/sales/${sale.id}`}
                        className="hover:text-brand"
                      >
                        {sale.number}
                      </Link>
                    </p>
                    <p className="text-sm text-ink-muted">
                      {formatDateTime(sale.createdAt)}
                      {sale.customer ? ` · ${sale.customer.name}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">
                    {formatPaisa(sale.totalPaisa)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("dashboard.lowStock")}</h2>
            <Link
              href="/products"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              {t("dashboard.viewProducts")}
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboard.inventoryValue")} {formatPaisa(stockValue)}.
          </p>

          {lowStock.length === 0 ? (
            <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
              {t("dashboard.everythingAboveLowStock")}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {lowStock.slice(0, 5).map((product) => (
                <li
                  key={product.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-ink-muted">
                      {product.category ?? t("dashboard.noCategory")}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">Low</Badge>
                    <p className="mt-1 text-sm tabular-nums text-warning">
                      {formatQuantity(product.stockMilli, product.unit)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {t("dashboard.customersWhoOwe")}
          </h2>
          <Link
            href="/customers"
            className="text-sm font-medium text-brand hover:text-brand-hover"
          >
            {t("dashboard.viewCustomers")}
          </Link>
        </div>

        {credit.topCustomers.length === 0 ? (
          <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
            {t("dashboard.noCustomerOwesMoney")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {credit.topCustomers.map((customer) => (
              <li
                key={customer.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="hover:text-brand"
                    >
                      {customer.name}
                    </Link>
                  </p>
                  {customer.phone ? (
                    <p className="text-sm text-ink-muted">{customer.phone}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-medium tabular-nums text-error">
                  {formatPaisa(customer.balancePaisa)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-sm text-ink-muted">
        Specification: <code className="font-mono">docs/</code> · Expenses,
        voiding, audit log, and backups are included.
      </footer>
    </main>
  );
}
