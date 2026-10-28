import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { isoDateKeyInKarachi } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import {
  runAssistantTool,
  type ToolRunResult,
} from "@/modules/assistant/tools";
import { createCustomer, recordPayment } from "@/modules/customers/service";
import { createExpense } from "@/modules/expenses/service";
import { createProduct } from "@/modules/products/service";
import { createSale } from "@/modules/sales/service";

const now = new Date();
const todayKey = isoDateKeyInKarachi(now);

const sugar = {
  name: "Sugar",
  category: "Grocery",
  unit: "kg",
  costPrice: "140",
  salePrice: "160",
  openingStock: "10",
  lowStockLevel: "2",
  barcode: "100001",
  aliases: "",
};

const soap = {
  name: "Soap",
  category: "Household",
  unit: "piece",
  costPrice: "50",
  salePrice: "75",
  openingStock: "20",
  lowStockLevel: "25",
  barcode: "100002",
  aliases: "",
};

const shampoo = {
  name: "Shampoo",
  category: "Personal care",
  unit: "piece",
  costPrice: "300",
  salePrice: "400",
  openingStock: "12",
  lowStockLevel: "2",
  barcode: "100003",
  aliases: "Dove",
};

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

function expectToolData<T>(result: ToolRunResult): T {
  if (!result.ok) {
    throw new Error(`Expected tool success but got: ${result.error}`);
  }

  return result.data as T;
}

async function runTool(name: string, input: unknown): Promise<ToolRunResult> {
  return runAssistantTool(name, JSON.stringify(input), { now });
}

async function seedShopData() {
  const sugarProduct = expectOk(await createProduct(sugar));
  const soapProduct = expectOk(await createProduct(soap));
  const shampooProduct = expectOk(await createProduct(shampoo));

  const customer = expectOk(
    await createCustomer({ name: "Ali Khan", phone: "0300 1234567" }),
  );

  const cashSale = expectOk(
    await createSale({
      items: [{ productId: sugarProduct.id, quantity: "2" }],
      discount: "0",
      paid: "400",
      paymentMethod: "CASH",
    }),
  );

  const creditSale = expectOk(
    await createSale({
      items: [{ productId: shampooProduct.id, quantity: "1" }],
      discount: "0",
      paid: "300",
      paymentMethod: "CREDIT",
      customerId: customer.id,
    }),
  );

  expectOk(
    await recordPayment({ customerId: customer.id, amount: "40" }),
  );

  expectOk(
    await createExpense({
      category: "RENT",
      amount: "100",
      date: todayKey,
    }),
  );
  expectOk(
    await createExpense({
      category: "ELECTRICITY",
      amount: "50",
      date: todayKey,
    }),
  );

  return {
    sugarProduct,
    soapProduct,
    shampooProduct,
    customer,
    cashSale,
    creditSale,
  };
}

let fixtures: Awaited<ReturnType<typeof seedShopData>>;

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.cashReconciliation.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.product.deleteMany();

  fixtures = await seedShopData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("assistant tools", () => {
  it("summarises sales, credit, expenses, and net profit", async () => {
    const data = expectToolData<Record<string, unknown>>(
      await runTool("sales_summary", { range: "today" }),
    );

    expect(data).toMatchObject({
      salesCount: 2,
      revenue: "Rs. 720.00",
      discounts: "Rs. 0.00",
      grossProfit: "Rs. 140.00",
      creditGiven: "Rs. 100.00",
      expenses: "Rs. 150.00",
      netProfit: "-Rs. 10.00",
    });
  });

  it("ranks products by revenue and reports a single product", async () => {
    const top = expectToolData<{
      products: Array<{ name: string; revenue: string }>;
    }>(await runTool("top_products", { range: "today", limit: 5 }));

    expect(top.products.map((row) => row.name)).toEqual([
      "Shampoo",
      "Sugar",
    ]);
    expect(top.products[0]?.revenue).toBe("Rs. 400.00");

    const single = expectToolData<{
      products: Array<{
        name: string;
        quantity: string;
        revenue: string;
        profit: string;
      }>;
    }>(await runTool("product_sales", { range: "today", product: "sugar" }));

    expect(single.products).toHaveLength(1);
    expect(single.products[0]).toMatchObject({
      name: "Sugar",
      quantity: "2 kg",
      revenue: "Rs. 320.00",
      profit: "Rs. 40.00",
    });
  });

  it("finds low stock, inventory value, and slow-moving stock", async () => {
    const low = expectToolData<{ products: Array<{ name: string }> }>(
      await runTool("low_stock", {}),
    );

    expect(low.products.map((row) => row.name)).toEqual(["Soap"]);

    const value = expectToolData<{ inventoryCostValue: string }>(
      await runTool("inventory_value", {}),
    );

    expect(value.inventoryCostValue).toBe("Rs. 5,420.00");

    const slow = expectToolData<{ products: Array<{ name: string }> }>(
      await runTool("slow_moving", { range: "today", limit: 10 }),
    );

    expect(slow.products.map((row) => row.name)).toContain("Soap");
    expect(slow.products.map((row) => row.name)).not.toContain("Sugar");
  });

  it("reports outstanding credit and one customer's balance", async () => {
    const credit = expectToolData<{
      totalOutstanding: string;
      customerCount: number;
      customers: Array<{ name: string; balance: string }>;
    }>(await runTool("outstanding_credit", { limit: 10 }));

    expect(credit.totalOutstanding).toBe("Rs. 60.00");
    expect(credit.customerCount).toBe(1);
    expect(credit.customers[0]).toMatchObject({
      name: "Ali Khan",
      balance: "Rs. 60.00",
    });

    const customer = expectToolData<{
      matches: number;
      customer: { name: string; balance: string };
      recent: Array<{ type: string; due?: string; amount?: string }>;
    }>(await runTool("customer_balance", { customer: "ali" }));

    expect(customer.matches).toBe(1);
    expect(customer.customer.balance).toBe("Rs. 60.00");
    expect(
      customer.recent.some(
        (entry) => entry.type === "Credit sale" && entry.due === "Rs. 100.00",
      ),
    ).toBe(true);
    expect(
      customer.recent.some(
        (entry) => entry.type === "Payment" && entry.amount === "Rs. 40.00",
      ),
    ).toBe(true);
  });

  it("lists recent sales with payment type and customer", async () => {
    const data = expectToolData<{
      sales: Array<{
        number: string;
        total: string;
        payment: string;
        customer: string;
      }>;
    }>(await runTool("recent_sales", { limit: 5 }));

    expect(data.sales).toHaveLength(2);
    expect(
      data.sales.some(
        (sale) =>
          sale.number === fixtures.cashSale.number &&
          sale.total === "Rs. 320.00" &&
          sale.payment === "Cash",
      ),
    ).toBe(true);
    expect(
      data.sales.some(
        (sale) =>
          sale.number === fixtures.creditSale.number &&
          sale.total === "Rs. 400.00" &&
          sale.payment === "Credit" &&
          sale.customer === "Ali Khan",
      ),
    ).toBe(true);
  });

  it("summarises expenses by category and expected cash", async () => {
    const expenses = expectToolData<{
      total: string;
      categories: Array<{ category: string; amount: string }>;
    }>(await runTool("expenses_summary", { range: "today" }));

    expect(expenses.total).toBe("Rs. 150.00");
    expect(expenses.categories).toEqual([
      { category: "Rent", amount: "Rs. 100.00" },
      { category: "Electricity", amount: "Rs. 50.00" },
    ]);

    const cash = expectToolData<Record<string, unknown>>(
      await runTool("expected_cash", { range: "today" }),
    );

    expect(cash).toMatchObject({
      cashSales: "Rs. 320.00",
      cashOnCreditSales: "Rs. 300.00",
      repayments: "Rs. 40.00",
      expenses: "Rs. 150.00",
      expectedCash: "Rs. 510.00",
    });
  });

  it("treats empty arguments as an empty object", async () => {
    const result = await runAssistantTool("low_stock", "", { now });

    expect(result.ok).toBe(true);
  });

  it("rejects unknown tools and invalid arguments", async () => {
    const unknown = await runTool("delete_everything", {});
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error).toContain("Unknown tool");
    }

    const invalid = await runTool("customer_balance", { customer: "" });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toContain("Invalid arguments");
    }
  });

  it("explains a custom range that is missing its dates", async () => {
    const result = await runTool("sales_summary", { range: "custom" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("both from and to");
    }
  });
});
