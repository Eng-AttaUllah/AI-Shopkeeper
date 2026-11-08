import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  isoDateKeyInKarachi,
  karachiDayRange,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { cashBreakdown, listReconciliations } from "@/modules/cash/queries";
import { recordReconciliation } from "@/modules/cash/service";
import { createCustomer, recordPayment } from "@/modules/customers/service";
import { createExpense } from "@/modules/expenses/service";
import { createProduct } from "@/modules/products/service";
import { createSale, voidSale } from "@/modules/sales/service";

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

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

let shopId: string;

beforeEach(async () => {
  const shop = await prisma.shop.create({
    data: { name: "Test Shop", currency: "PKR", timezone: "Asia/Karachi" },
  });
  shopId = shop.id;

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
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cashBreakdown", () => {
  it("adds cash in and subtracts expenses", async () => {
    const product = expectOk(await createProduct(shopId, sugar));
    const customer = expectOk(
      await createCustomer(shopId, { name: "Ali Khan" }),
    );
    const today = isoDateKeyInKarachi(new Date());

    // 2 kg x 160 = 320, customer handed 500, change 180.
    expectOk(
      await createSale(shopId, {
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CASH",
        paid: "500",
      }),
    );

    // 1 kg on credit, 50 paid at the counter.
    expectOk(
      await createSale(shopId, {
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
        paid: "50",
      }),
    );

    // The credit sale left 110 outstanding; repay 100.
    expectOk(
      await recordPayment(shopId, { customerId: customer.id, amount: "100" }),
    );

    expectOk(
      await createExpense(shopId, {
        category: "TRANSPORT",
        amount: "30",
        date: today,
      }),
    );

    const breakdown = await cashBreakdown(
      prisma,
      karachiDayRange(new Date()),
      shopId,
    );

    expect(breakdown.cashSalesPaisa).toBe(32000);
    expect(breakdown.creditCashPaisa).toBe(5000);
    expect(breakdown.repaymentsPaisa).toBe(10000);
    expect(breakdown.expensesPaisa).toBe(3000);
    expect(breakdown.expectedPaisa).toBe(44000);
  });

  it("excludes a voided sale", async () => {
    const product = expectOk(await createProduct(shopId, sugar));

    const sale = expectOk(
      await createSale(shopId, {
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );
    expectOk(await voidSale(shopId, sale.id, { reason: "Entered by mistake" }));

    const breakdown = await cashBreakdown(
      prisma,
      karachiDayRange(new Date()),
      shopId,
    );

    expect(breakdown.cashSalesPaisa).toBe(0);
    expect(breakdown.expectedPaisa).toBe(0);
  });
});

describe("recordReconciliation", () => {
  it("saves the difference and updates the same day on a re-run", async () => {
    const product = expectOk(await createProduct(shopId, sugar));

    expectOk(
      await createSale(shopId, {
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );

    const today = isoDateKeyInKarachi(new Date());
    const first = expectOk(
      await recordReconciliation(shopId, {
        date: today,
        counted: "170",
        note: "Counted at closing",
      }),
    );

    expect(first.expectedPaisa).toBe(16000);
    expect(first.countedPaisa).toBe(17000);
    expect(first.differencePaisa).toBe(1000);

    const second = expectOk(
      await recordReconciliation(shopId, { date: today, counted: "160" }),
    );

    expect(second.id).toBe(first.id);
    expect(second.differencePaisa).toBe(0);
    expect(await prisma.cashReconciliation.count()).toBe(1);

    const history = await listReconciliations(shopId);
    expect(history).toHaveLength(1);
    expect(history[0]?.countedPaisa).toBe(16000);

    expect(
      await prisma.auditLog.count({ where: { action: "CASH_RECONCILED" } }),
    ).toBe(2);
  });

  it("rejects an impossible date and a bad counted amount", async () => {
    const badDate = await recordReconciliation(shopId, {
      date: "2026-02-31",
      counted: "100",
    });
    const badAmount = await recordReconciliation(shopId, {
      date: "2026-10-26",
      counted: "ten",
    });

    expect(badDate.ok).toBe(false);
    expect(badAmount.ok).toBe(false);
    expect(await prisma.cashReconciliation.count()).toBe(0);
  });
});
