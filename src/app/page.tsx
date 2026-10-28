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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            {shop?.name ?? "Your shop"} · {formatDate(now)}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This month:{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.revenuePaisa)}
            </span>{" "}
            revenue ·{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.profitPaisa)}
            </span>{" "}
            gross profit ·{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.expensePaisa)}
            </span>{" "}
            expenses ·{" "}
            <span className="font-medium text-ink">
              {formatPaisa(month.netProfitPaisa)}
            </span>{" "}
            net profit ·{" "}
            <span className="font-medium text-ink">{month.salesCount}</span>{" "}
            {month.salesCount === 1 ? "sale" : "sales"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/sell"
            className={buttonVariants({ className: "h-11 px-4 text-base" })}
          >
            Start a sale
          </Link>
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
            href="/assistant"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            Ask assistant
          </Link>
          <Link
            href="/day-close"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            Day close
          </Link>
        </div>
      </header>

      <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today's revenue"
          value={formatPaisa(today.revenuePaisa)}
          hint={`${today.salesCount} ${today.salesCount === 1 ? "sale" : "sales"}`}
        />
        <StatCard
          label="Today's profit"
          value={formatPaisa(today.profitPaisa)}
          hint={`Before expenses · Cost ${formatPaisa(today.costPaisa)}`}
        />
        <StatCard
          label="Credit given today"
          value={formatPaisa(today.creditGivenPaisa)}
          hint="New khata"
          tone={today.creditGivenPaisa > 0 ? "error" : "default"}
        />
        <StatCard
          label="Outstanding credit"
          value={formatPaisa(credit.totalPaisa)}
          hint={
            credit.customerCount === 0
              ? "No one owes"
              : `${credit.customerCount} ${
                  credit.customerCount === 1 ? "customer owes" : "customers owe"
                }`
          }
          tone={credit.totalPaisa > 0 ? "error" : "default"}
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Sales, last 14 days</h2>
            <p className="text-sm text-ink-muted">
              Daily revenue in Asia/Karachi time.
            </p>
          </div>
          <Link
            href="/reports?period=month"
            className="text-sm font-medium text-brand hover:text-brand-hover"
          >
            Monthly report
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
            <h2 className="text-lg font-semibold">Recent sales</h2>
            <Link
              href="/sales"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              View all
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
              No sales yet.{" "}
              <Link href="/sell" className="text-brand underline">
                Start a sale
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
            <h2 className="text-lg font-semibold">Low stock</h2>
            <Link
              href="/products"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              View products
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Inventory value {formatPaisa(stockValue)}.
          </p>

          {lowStock.length === 0 ? (
            <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
              Everything is above its low-stock level.
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
                      {product.category ?? "No category"}
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
          <h2 className="text-lg font-semibold">Customers who owe</h2>
          <Link
            href="/customers"
            className="text-sm font-medium text-brand hover:text-brand-hover"
          >
            View customers
          </Link>
        </div>

        {credit.topCustomers.length === 0 ? (
          <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
            No customer owes money.
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
