import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  karachiDateTime,
  karachiMonthRange,
  karachiYearRange,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { createCustomer, recordPayment } from "@/modules/customers/service";
import { createExpense } from "@/modules/expenses/service";
import {
  createProduct,
  setProductActive,
  updateProduct,
} from "@/modules/products/service";
import {
  periodSummary,
  productSales,
  resolveReportRange,
  salesSeries,
  salesSummary,
  slowMovingProducts,
} from "@/modules/reports/queries";
import { reportQuerySchema } from "@/modules/reports/schema";
import { createSale } from "@/modules/sales/service";

const sugar = {
  name: "Sugar",
  category: "Grocery",
  unit: "kg",
  costPrice: "140",
  salePrice: "160",
  openingStock: "100",
  lowStockLevel: "10",
  barcode: "",
  aliases: "",
};

const soap = {
  name: "Soap",
  category: "Household",
  unit: "piece",
  costPrice: "60",
  salePrice: "100",
  openingStock: "50",
  lowStockLevel: "5",
  barcode: "",
  aliases: "",
};

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

function dayRange(year: number, month: number, day: number) {
  return {
    start: karachiDateTime(year, month, day),
    end: karachiDateTime(year, month, day + 1),
  };
}

type SaleOptions = {
  paymentMethod?: "CASH" | "CREDIT";
  customerId?: string;
  paid?: string;
  discount?: string;
};

async function saleAt(
  productId: string,
  quantity: string,
  createdAt: Date,
  options: SaleOptions = {},
) {
  const sale = expectOk(
    await createSale({
      items: [{ productId, quantity }],
      discount: options.discount ?? "0",
      paid: options.paid,
      paymentMethod: options.paymentMethod ?? "CASH",
      customerId: options.customerId,
    }),
  );

  await prisma.sale.update({
    where: { id: sale.id },
    data: { createdAt },
  });

  return sale;
}

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("periodSummary", () => {
  it("subtracts expenses from gross profit for net profit", async () => {
    const product = expectOk(await createProduct(sugar));

    await saleAt(product.id, "2", new Date("2026-10-26T10:00:00Z"));
    expectOk(
      await createExpense({
        category: "RENT",
        amount: "100",
        date: "2026-10-26",
      }),
    );

    const summary = await periodSummary(dayRange(2026, 10, 26));

    expect(summary.profitPaisa).toBe(4000);
    expect(summary.expensePaisa).toBe(10000);
    expect(summary.netProfitPaisa).toBe(-6000);
  });

  it("ignores expenses outside the range", async () => {
    const product = expectOk(await createProduct(sugar));

    await saleAt(product.id, "2", new Date("2026-10-26T10:00:00Z"));
    expectOk(
      await createExpense({
        category: "RENT",
        amount: "100",
        date: "2026-10-25",
      }),
    );

    const summary = await periodSummary(dayRange(2026, 10, 26));

    expect(summary.expensePaisa).toBe(0);
    expect(summary.netProfitPaisa).toBe(4000);
  });
});

describe("salesSummary", () => {
  it("puts a sale on the Karachi day it was recorded", async () => {
    const product = expectOk(await createProduct(sugar));

    // 23:59:59 on 25 October in Karachi.
    await saleAt(product.id, "2", new Date("2026-10-25T18:59:59Z"));
    // 00:00:00 on 26 October in Karachi.
    await saleAt(product.id, "1", new Date("2026-10-25T19:00:00Z"));

    const october25 = await salesSummary(dayRange(2026, 10, 25));
    const october26 = await salesSummary(dayRange(2026, 10, 26));

    expect(october25).toMatchObject({
      salesCount: 1,
      revenuePaisa: 32000,
      profitPaisa: 4000,
    });
    expect(october26).toMatchObject({
      salesCount: 1,
      revenuePaisa: 16000,
      profitPaisa: 2000,
    });
  });

  it("splits months and years at Karachi midnight", async () => {
    const product = expectOk(await createProduct(sugar));

    // 23:59:59 on 31 October in Karachi.
    await saleAt(product.id, "1", new Date("2026-10-31T18:59:59Z"));
    // 00:00:00 on 1 November in Karachi.
    await saleAt(product.id, "1", new Date("2026-10-31T19:00:00Z"));

    const october = karachiMonthRange(new Date("2026-10-15T10:00:00Z"));
    const november = karachiMonthRange(new Date("2026-11-15T10:00:00Z"));

    expect((await salesSummary(october)).salesCount).toBe(1);
    expect((await salesSummary(november)).salesCount).toBe(1);

    // 23:59:59 on 31 December 2026 in Karachi.
    await saleAt(product.id, "1", new Date("2026-12-31T18:59:59Z"));
    // 00:00:00 on 1 January 2027 in Karachi.
    await saleAt(product.id, "1", new Date("2026-12-31T19:00:00Z"));

    const year2026 = karachiYearRange(new Date("2026-06-01T10:00:00Z"));
    const year2027 = karachiYearRange(new Date("2027-06-01T10:00:00Z"));

    expect((await salesSummary(year2026)).salesCount).toBe(3);
    expect((await salesSummary(year2027)).salesCount).toBe(1);
  });

  it("keeps profit on the cost snapshot after a price change", async () => {
    const product = expectOk(await createProduct(sugar));

    await saleAt(product.id, "1", new Date("2026-10-26T10:00:00Z"));

    expectOk(
      await updateProduct(product.id, {
        ...sugar,
        costPrice: "200",
        salePrice: "250",
      }),
    );

    const summary = await salesSummary(dayRange(2026, 10, 26));
    expect(summary.revenuePaisa).toBe(16000);
    expect(summary.costPaisa).toBe(14000);
    expect(summary.profitPaisa).toBe(2000);

    const rows = await productSales(dayRange(2026, 10, 26));
    expect(rows[0]?.profitPaisa).toBe(2000);
  });

  it("counts a credit sale once and treats repayment as settlement", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    await saleAt(product.id, "2", new Date("2026-10-26T10:00:00Z"), {
      paymentMethod: "CREDIT",
      customerId: customer.id,
      paid: "100",
    });

    const range = dayRange(2026, 10, 26);

    expect(await salesSummary(range)).toMatchObject({
      salesCount: 1,
      revenuePaisa: 32000,
      profitPaisa: 4000,
      creditGivenPaisa: 22000,
    });

    expectOk(
      await recordPayment({ customerId: customer.id, amount: "50" }),
    );

    expect(await salesSummary(range)).toMatchObject({
      salesCount: 1,
      revenuePaisa: 32000,
      profitPaisa: 4000,
      creditGivenPaisa: 22000,
    });
  });

  it("subtracts the sale-level discount from revenue but not from line sales", async () => {
    const product = expectOk(await createProduct(sugar));

    await saleAt(product.id, "2", new Date("2026-10-26T10:00:00Z"), {
      discount: "20",
    });

    const range = dayRange(2026, 10, 26);
    const summary = await salesSummary(range);

    expect(summary.revenuePaisa).toBe(30000);
    expect(summary.discountPaisa).toBe(2000);
    expect(summary.profitPaisa).toBe(2000);

    const rows = await productSales(range);
    expect(rows[0]?.revenuePaisa).toBe(32000);
  });

  it("excludes voided sales from every report", async () => {
    const product = expectOk(await createProduct(sugar));
    const sale = await saleAt(
      product.id,
      "1",
      new Date("2026-10-26T10:00:00Z"),
    );

    await prisma.sale.update({
      where: { id: sale.id },
      data: { voidedAt: new Date(), voidedReason: "test void" },
    });

    const range = dayRange(2026, 10, 26);

    expect(await salesSummary(range)).toMatchObject({
      salesCount: 0,
      revenuePaisa: 0,
      profitPaisa: 0,
      creditGivenPaisa: 0,
    });
    expect(await productSales(range)).toEqual([]);

    const series = await salesSeries(range);
    expect(series.points.every((point) => point.revenuePaisa === 0)).toBe(true);
  });

  it("returns zeros for a period with no sales", async () => {
    expectOk(await createProduct(sugar));

    const range = dayRange(2020, 1, 1);

    expect(await salesSummary(range)).toEqual({
      salesCount: 0,
      revenuePaisa: 0,
      discountPaisa: 0,
      costPaisa: 0,
      profitPaisa: 0,
      creditGivenPaisa: 0,
    });
  });
});

describe("product reports", () => {
  it("groups sales by product and ranks by line sales", async () => {
    const sugarProduct = expectOk(await createProduct(sugar));
    const soapProduct = expectOk(await createProduct(soap));

    await saleAt(sugarProduct.id, "2", new Date("2026-10-26T10:00:00Z"));
    await saleAt(soapProduct.id, "3", new Date("2026-10-26T11:00:00Z"));

    const rows = await productSales(dayRange(2026, 10, 26));

    expect(
      rows.map((row) => [
        row.productName,
        row.quantityMilli,
        row.revenuePaisa,
        row.profitPaisa,
      ]),
    ).toEqual([
      ["Sugar", 2000, 32000, 4000],
      ["Soap", 3000, 30000, 12000],
    ]);
  });

  it("lists active stocked products that sold nothing", async () => {
    const sugarProduct = expectOk(await createProduct(sugar));
    expectOk(await createProduct(soap));
    const hidden = expectOk(
      await createProduct({ ...soap, name: "Hidden Soap" }),
    );
    expectOk(await setProductActive(hidden.id, false));
    expectOk(
      await createProduct({
        ...soap,
        name: "Empty Soap",
        openingStock: "0",
      }),
    );

    await saleAt(sugarProduct.id, "1", new Date("2026-10-26T10:00:00Z"));

    const slow = await slowMovingProducts(dayRange(2026, 10, 26));

    expect(slow.map((product) => product.name)).toEqual(["Soap"]);
  });
});

describe("salesSeries", () => {
  it("groups revenue into daily buckets, including empty days", async () => {
    const product = expectOk(await createProduct(sugar));

    // 01:00 on 26 October in Karachi.
    await saleAt(product.id, "1", new Date("2026-10-25T20:00:00Z"));
    // 15:00 on 26 October in Karachi.
    await saleAt(product.id, "2", new Date("2026-10-26T10:00:00Z"));

    const series = await salesSeries({
      start: karachiDateTime(2026, 10, 26),
      end: karachiDateTime(2026, 10, 28),
    });

    expect(series.granularity).toBe("day");
    expect(series.points.map((point) => [point.key, point.revenuePaisa])).toEqual(
      [
        ["20261026", 48000],
        ["20261027", 0],
      ],
    );
  });

  it("uses monthly buckets for long ranges", async () => {
    const product = expectOk(await createProduct(sugar));
    await saleAt(product.id, "1", new Date("2026-10-26T10:00:00Z"));

    const series = await salesSeries({
      start: karachiDateTime(2026, 9, 1),
      end: karachiDateTime(2026, 11, 1),
    });

    expect(series.granularity).toBe("month");
    expect(series.points.map((point) => point.key)).toEqual([
      "202609",
      "202610",
    ]);
    expect(series.points[1]?.revenuePaisa).toBe(16000);
  });
});

describe("resolveReportRange", () => {
  const now = new Date("2026-10-26T10:00:00Z");

  it("builds today's local day", () => {
    const resolved = expectOk(resolveReportRange({ period: "today" }, now));

    expect(resolved.range.start.toISOString()).toBe(
      "2026-10-25T19:00:00.000Z",
    );
    expect(resolved.range.end.toISOString()).toBe(
      "2026-10-26T19:00:00.000Z",
    );
    expect(resolved.fromKey).toBe("2026-10-26");
    expect(resolved.toKey).toBe("2026-10-26");
  });

  it("builds month-to-date and year-to-date ranges", () => {
    const month = expectOk(resolveReportRange({ period: "month" }, now));
    expect(month.range.start.toISOString()).toBe(
      "2026-09-30T19:00:00.000Z",
    );
    expect(month.range.end.toISOString()).toBe(
      "2026-10-26T19:00:00.000Z",
    );
    expect(month.fromKey).toBe("2026-10-01");
    expect(month.toKey).toBe("2026-10-26");

    const year = expectOk(resolveReportRange({ period: "year" }, now));
    expect(year.range.start.toISOString()).toBe(
      "2025-12-31T19:00:00.000Z",
    );
    expect(year.range.end.toISOString()).toBe(
      "2026-10-26T19:00:00.000Z",
    );
    expect(year.fromKey).toBe("2026-01-01");
  });

  it("includes both chosen days in a custom range", () => {
    const resolved = expectOk(
      resolveReportRange(
        { period: "custom", from: "2026-10-01", to: "2026-10-03" },
        now,
      ),
    );

    expect(resolved.range.start.toISOString()).toBe(
      "2026-09-30T19:00:00.000Z",
    );
    expect(resolved.range.end.toISOString()).toBe(
      "2026-10-03T19:00:00.000Z",
    );
    expect(resolved.label).toBe("01 Oct 2026 – 03 Oct 2026");
  });

  it("rejects an inverted or impossible custom range", () => {
    expect(
      resolveReportRange(
        { period: "custom", from: "2026-10-05", to: "2026-10-01" },
        now,
      ).ok,
    ).toBe(false);

    expect(
      resolveReportRange(
        { period: "custom", from: "2026-02-31", to: "2026-03-01" },
        now,
      ).ok,
    ).toBe(false);
  });

  it("defaults a custom range to the month so far", () => {
    const resolved = expectOk(resolveReportRange({ period: "custom" }, now));

    expect(resolved.fromKey).toBe("2026-10-01");
    expect(resolved.toKey).toBe("2026-10-26");
  });

  it("falls back to today for an unknown period", () => {
    const parsed = reportQuerySchema.safeParse({ period: "weekly" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.period).toBe("today");
    }
  });
});
