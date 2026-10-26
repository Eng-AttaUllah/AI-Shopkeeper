import Link from "next/link";

import { SalesBarChart } from "@/components/reports/sales-bar-chart";
import { StatCard } from "@/components/reports/stat-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import {
  productSales,
  resolveReportRange,
  salesSeries,
  salesSummary,
  slowMovingProducts,
} from "@/modules/reports/queries";
import { reportQuerySchema, type ReportPeriod } from "@/modules/reports/schema";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
};

const PERIOD_LINKS: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const parsed = reportQuerySchema.safeParse({
    period: first(params.period),
    from: first(params.from),
    to: first(params.to),
  });
  const query = parsed.success ? parsed.data : { period: "today" as const };
  const resolved = resolveReportRange(query);
  const active = resolved.ok
    ? resolved
    : resolveReportRange({ period: "month" });

  if (!active.ok) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8">
        <h1 className="text-3xl font-semibold">Reports</h1>
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          Reports could not be loaded. Please try again.
        </p>
      </main>
    );
  }

  const { period, range, fromKey, toKey, label } = active.data;

  const [summary, products, series, slowMoving] = await Promise.all([
    salesSummary(range),
    productSales(range),
    salesSeries(range),
    slowMovingProducts(range, 5),
  ]);
  const bestSellers = products.slice(0, 5);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-ink-muted">{label}</p>
        </div>
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 px-4 text-base",
          })}
        >
          Dashboard
        </Link>
      </header>

      {!resolved.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {resolved.error} Showing this month instead.
        </p>
      ) : null}

      <nav aria-label="Report period" className="flex flex-wrap gap-2">
        {PERIOD_LINKS.map((item) => (
          <Link
            key={item.value}
            href={
              item.value === "custom"
                ? `/reports?period=custom&from=${fromKey}&to=${toKey}`
                : `/reports?period=${item.value}`
            }
            aria-current={period === item.value ? "page" : undefined}
            className={buttonVariants({
              variant: period === item.value ? "default" : "outline",
              className: "h-11 px-4 text-base",
            })}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {period === "custom" ? (
        <form
          action="/reports"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <input type="hidden" name="period" value="custom" />

          <div className="flex flex-col gap-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={fromKey}
              className="h-11 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={toKey}
              className="h-11 text-base"
            />
          </div>

          <Button type="submit" className="h-11 px-4 text-base">
            Apply
          </Button>
        </form>
      ) : null}

      <section
        aria-label="Summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard
          label="Sales"
          value={String(summary.salesCount)}
          hint={label}
        />
        <StatCard
          label="Revenue"
          value={formatPaisa(summary.revenuePaisa)}
          hint={`Discounts ${formatPaisa(summary.discountPaisa)}`}
        />
        <StatCard
          label="Gross profit"
          value={formatPaisa(summary.profitPaisa)}
          hint={`Cost of goods ${formatPaisa(summary.costPaisa)}`}
        />
        <StatCard
          label="Credit given"
          value={formatPaisa(summary.creditGivenPaisa)}
          hint="New khata in this period"
          tone={summary.creditGivenPaisa > 0 ? "error" : "default"}
        />
      </section>

      <p className="text-xs text-ink-muted">
        Revenue counts a sale when it is recorded, including the unpaid part of
        a credit sale. Repayments reduce khata but do not add revenue. Gross
        profit uses the cost price stored on each sale line.
      </p>

      {period !== "today" && series.points.length > 1 ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">
            Revenue by {series.granularity === "day" ? "day" : "month"}
          </h2>
          <p className="text-sm text-ink-muted">{label}</p>
          <div className="mt-4">
            <SalesBarChart
              points={series.points}
              label={`Revenue by ${series.granularity} for ${label}`}
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Sales by product</h2>
            <p className="text-sm text-ink-muted">
              Line sales and profit before any sale-level discount.
            </p>
          </div>
          <p className="text-sm text-ink-muted">
            {products.length}{" "}
            {products.length === 1 ? "product sold" : "products sold"}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-line p-6 text-center">
            <p className="font-medium">No sales in this period.</p>
            <p className="mt-1 text-sm text-ink-muted">
              Choose another period or record a sale.
            </p>
            <Link
              href="/sell"
              className={buttonVariants({
                className: "mt-4 h-11 px-4 text-base",
              })}
            >
              Start a sale
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-lg border border-line md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Line sales</TableHead>
                    <TableHead>Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell className="font-medium">
                        {row.productName}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatQuantity(row.quantityMilli, row.unit)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatPaisa(row.revenuePaisa)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatPaisa(row.profitPaisa)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="mt-4 flex flex-col gap-3 md:hidden">
              {products.map((row) => (
                <li
                  key={row.productId}
                  className="rounded-lg border border-line p-3"
                >
                  <p className="font-medium">{row.productName}</p>
                  <p className="text-sm text-ink-muted">
                    {formatQuantity(row.quantityMilli, row.unit)} sold
                  </p>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-ink-muted">Line sales</span>
                    <span className="tabular-nums">
                      {formatPaisa(row.revenuePaisa)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-ink-muted">Profit</span>
                    <span className="tabular-nums">
                      {formatPaisa(row.profitPaisa)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Best sellers</h2>
          <p className="text-sm text-ink-muted">
            Ranked by line sales in this period.
          </p>

          {bestSellers.length === 0 ? (
            <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
              Nothing sold in this period.
            </p>
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {bestSellers.map((row, index) => (
                <li
                  key={row.productId}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{row.productName}</p>
                      <p className="text-sm text-ink-muted">
                        {formatQuantity(row.quantityMilli, row.unit)} sold
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">
                    {formatPaisa(row.revenuePaisa)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Slow movers</h2>
          <p className="text-sm text-ink-muted">
            Active products with stock that sold nothing in this period.
          </p>

          {slowMoving.length === 0 ? (
            <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
              No stock is sitting still.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {slowMoving.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-ink-muted">
                      {formatQuantity(product.stockMilli, product.unit)} in
                      stock
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-ink-muted">
                    {formatPaisa(product.stockValuePaisa)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
