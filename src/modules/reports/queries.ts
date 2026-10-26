import { prisma } from "@/lib/db";
import {
  addKarachiDays,
  dateKeyInKarachi,
  eachKarachiDay,
  eachKarachiMonth,
  isoDateKeyInKarachi,
  karachiDateKeyToDate,
  karachiDayRange,
  karachiParts,
  startOfKarachiMonth,
  startOfKarachiYear,
  type DateRange,
} from "@/lib/dates";
import { formatDate, formatDayMonth, formatMonthYear } from "@/lib/format";
import { multiplyPaisa } from "@/lib/money";
import { fromMilli } from "@/lib/quantity";
import { fail, ok, type Result } from "@/lib/result";
import {
  listCustomersWithBalances,
  type CustomerWithBalance,
} from "@/modules/customers/queries";

import type { ReportPeriod, ReportQuery } from "./schema";

/**
 * Reporting rules.
 *
 * Revenue is recognised when a sale is recorded (accrual), not when a credit
 * sale is paid. A credit sale therefore counts once in revenue and profit, and
 * its unpaid part is reported separately as "credit given". Repayments settle
 * an existing sale and never add revenue. Voided sales are excluded everywhere.
 *
 * Per-product revenue and profit are line totals before the sale-level
 * discount, because a discount is applied to the sale as a whole and is not
 * allocated across lines. The summary subtracts discounts from revenue, so the
 * two figures are labelled differently in the UI.
 */

export type SalesSummary = {
  salesCount: number;
  revenuePaisa: number;
  discountPaisa: number;
  costPaisa: number;
  profitPaisa: number;
  creditGivenPaisa: number;
};

export type ProductSalesRow = {
  productId: string;
  productName: string;
  unit: string;
  quantityMilli: number;
  revenuePaisa: number;
  profitPaisa: number;
};

export type SlowMovingProduct = {
  id: string;
  name: string;
  unit: string;
  stockMilli: number;
  stockValuePaisa: number;
};

export type SeriesPoint = {
  key: string;
  label: string;
  revenuePaisa: number;
};

export type SalesSeries = {
  granularity: "day" | "month";
  points: SeriesPoint[];
};

export type CreditOverview = {
  totalPaisa: number;
  customerCount: number;
  topCustomers: CustomerWithBalance[];
};

export type ResolvedReportRange = {
  period: ReportPeriod;
  range: DateRange;
  /** Shop-local `YYYY-MM-DD` keys for the custom date form. */
  fromKey: string;
  toKey: string;
  label: string;
};

function monthStartKey(now: Date): string {
  const parts = karachiParts(now);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-01`;
}

function yearStartKey(now: Date): string {
  return `${karachiParts(now).year}-01-01`;
}

/**
 * Turn validated search parameters into a concrete range in Asia/Karachi.
 *
 * "This month" and "this year" are month-to-date and year-to-date: they end at
 * the start of tomorrow, so a chart never shows empty future days. A custom
 * range is inclusive of both chosen days.
 */
export function resolveReportRange(
  query: ReportQuery,
  now = new Date(),
): Result<ResolvedReportRange> {
  const todayKey = isoDateKeyInKarachi(now);
  const todayRange = karachiDayRange(now);
  const parts = karachiParts(now);

  if (query.period === "custom") {
    const fromKey = query.from || monthStartKey(now);
    const toKey = query.to || todayKey;
    const fromDate = karachiDateKeyToDate(fromKey);
    const toDate = karachiDateKeyToDate(toKey);

    if (!fromDate) {
      return fail("Enter a valid start date.");
    }

    if (!toDate) {
      return fail("Enter a valid end date.");
    }

    if (fromDate > toDate) {
      return fail("The start date must be on or before the end date.");
    }

    return ok({
      period: "custom",
      range: { start: fromDate, end: addKarachiDays(toDate, 1) },
      fromKey,
      toKey,
      label:
        fromKey === toKey
          ? formatDate(fromDate)
          : `${formatDate(fromDate)} – ${formatDate(toDate)}`,
    });
  }

  if (query.period === "month") {
    return ok({
      period: "month",
      range: { start: startOfKarachiMonth(now), end: todayRange.end },
      fromKey: monthStartKey(now),
      toKey: todayKey,
      label: formatMonthYear(now),
    });
  }

  if (query.period === "year") {
    return ok({
      period: "year",
      range: { start: startOfKarachiYear(now), end: todayRange.end },
      fromKey: yearStartKey(now),
      toKey: todayKey,
      label: String(parts.year),
    });
  }

  return ok({
    period: "today",
    range: todayRange,
    fromKey: todayKey,
    toKey: todayKey,
    label: `Today, ${formatDate(now)}`,
  });
}

/** Totals for one period. Voided sales are excluded. */
export async function salesSummary(range: DateRange): Promise<SalesSummary> {
  const saleWhere = {
    voidedAt: null,
    createdAt: { gte: range.start, lt: range.end },
  };

  const [sales, items, credit] = await Promise.all([
    prisma.sale.aggregate({
      where: saleWhere,
      _count: { _all: true },
      _sum: { totalPaisa: true, discountPaisa: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: saleWhere },
      _sum: { lineCostPaisa: true },
    }),
    prisma.sale.aggregate({
      where: { ...saleWhere, paymentMethod: "CREDIT" },
      _sum: { totalPaisa: true, paidPaisa: true },
    }),
  ]);

  const revenuePaisa = sales._sum.totalPaisa ?? 0;
  const costPaisa = items._sum.lineCostPaisa ?? 0;

  return {
    salesCount: sales._count._all,
    revenuePaisa,
    discountPaisa: sales._sum.discountPaisa ?? 0,
    costPaisa,
    profitPaisa: revenuePaisa - costPaisa,
    creditGivenPaisa:
      (credit._sum.totalPaisa ?? 0) - (credit._sum.paidPaisa ?? 0),
  };
}

/**
 * Sales per product for the period, highest revenue first. Revenue and profit
 * are the line values before any sale-level discount.
 */
export async function productSales(
  range: DateRange,
): Promise<ProductSalesRow[]> {
  const groups = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: {
      sale: { voidedAt: null, createdAt: { gte: range.start, lt: range.end } },
    },
    _sum: { quantityMilli: true, lineTotalPaisa: true, lineCostPaisa: true },
  });

  if (groups.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: { id: { in: groups.map((group) => group.productId) } },
    select: { id: true, name: true, unit: true },
  });
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );

  return groups
    .map((group) => {
      const product = productsById.get(group.productId);
      const revenuePaisa = group._sum.lineTotalPaisa ?? 0;
      const costPaisa = group._sum.lineCostPaisa ?? 0;

      return {
        productId: group.productId,
        productName: product?.name ?? "Unknown product",
        unit: product?.unit ?? "piece",
        quantityMilli: group._sum.quantityMilli ?? 0,
        revenuePaisa,
        profitPaisa: revenuePaisa - costPaisa,
      };
    })
    .sort(
      (a, b) =>
        b.revenuePaisa - a.revenuePaisa ||
        a.productName.localeCompare(b.productName),
    );
}

/**
 * Active products with stock on hand that sold nothing in the period, ordered
 * by the cost value of the stock sitting still.
 */
export async function slowMovingProducts(
  range: DateRange,
  take = 5,
): Promise<SlowMovingProduct[]> {
  const sold = await prisma.saleItem.findMany({
    where: {
      sale: { voidedAt: null, createdAt: { gte: range.start, lt: range.end } },
    },
    select: { productId: true },
    distinct: ["productId"],
  });
  const soldIds = new Set(sold.map((row) => row.productId));

  const products = await prisma.product.findMany({
    where: { isActive: true, stockMilli: { gt: 0 } },
    select: {
      id: true,
      name: true,
      unit: true,
      stockMilli: true,
      costPricePaisa: true,
    },
  });

  return products
    .filter((product) => !soldIds.has(product.id))
    .map((product) => ({
      id: product.id,
      name: product.name,
      unit: product.unit,
      stockMilli: product.stockMilli,
      stockValuePaisa: multiplyPaisa(
        product.costPricePaisa,
        fromMilli(product.stockMilli),
      ),
    }))
    .sort(
      (a, b) =>
        b.stockValuePaisa - a.stockValuePaisa || a.name.localeCompare(b.name),
    )
    .slice(0, take);
}

/**
 * Revenue per day for ranges up to 31 days, otherwise per month. Every bucket
 * is present, including empty ones, so a chart has a stable shape.
 */
export async function salesSeries(range: DateRange): Promise<SalesSeries> {
  const days = eachKarachiDay(range);
  const useDaily = days.length <= 31;
  const buckets = useDaily ? days : eachKarachiMonth(range);

  const sales = await prisma.sale.findMany({
    where: {
      voidedAt: null,
      createdAt: { gte: range.start, lt: range.end },
    },
    select: { createdAt: true, totalPaisa: true },
  });

  const totals = new Map<string, number>();

  for (const bucket of buckets) {
    totals.set(bucket.key, 0);
  }

  for (const sale of sales) {
    const key = useDaily
      ? dateKeyInKarachi(sale.createdAt)
      : dateKeyInKarachi(sale.createdAt).slice(0, 6);
    const current = totals.get(key);

    if (current !== undefined) {
      totals.set(key, current + sale.totalPaisa);
    }
  }

  return {
    granularity: useDaily ? "day" : "month",
    points: buckets.map((bucket) => ({
      key: bucket.key,
      label: useDaily
        ? formatDayMonth(bucket.date)
        : formatMonthYear(bucket.date),
      revenuePaisa: totals.get(bucket.key) ?? 0,
    })),
  };
}

/** Total khata and the customers who owe the most. */
export async function creditOverview(take = 5): Promise<CreditOverview> {
  const customers = await listCustomersWithBalances();
  const owing = customers
    .filter((customer) => customer.balancePaisa > 0)
    .sort(
      (a, b) =>
        b.balancePaisa - a.balancePaisa || a.name.localeCompare(b.name),
    );

  return {
    totalPaisa: owing.reduce(
      (total, customer) => total + customer.balancePaisa,
      0,
    ),
    customerCount: owing.length,
    topCustomers: owing.slice(0, take),
  };
}
