import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { isoDateKeyInKarachi } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { recordReconciliation } from "@/modules/cash/service";
import { createCustomer, recordPayment } from "@/modules/customers/service";
import { createExpense } from "@/modules/expenses/service";
import {
  adjustStock,
  createProduct,
  updateProduct,
} from "@/modules/products/service";
import { createSale, voidSale } from "@/modules/sales/service";

const sugar = {
  name: "Sugar",
  category: "Grocery",
  unit: "kg",
  costPrice: "140",
  salePrice: "160",
  openingStock: "10",
  lowStockLevel: "1",
  barcode: "",
  aliases: "",
};

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

async function actions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => row.action);
}

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
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("audit log", () => {
  it("records every money and stock change with before and after state", async () => {
    const product = expectOk(await createProduct(sugar));
    expectOk(await updateProduct(product.id, { ...sugar, salePrice: "170" }));
    expectOk(
      await adjustStock({
        productId: product.id,
        quantity: "5",
        reason: "RESTOCK",
        note: "",
      }),
    );

    const cashSale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );
    expectOk(await voidSale(cashSale.id, { reason: "Wrong item" }));

    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));
    const creditSale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );
    expectOk(await recordPayment({ customerId: customer.id, amount: "50" }));
    expectOk(
      await createExpense({
        category: "OTHER",
        amount: "25",
        date: isoDateKeyInKarachi(new Date()),
      }),
    );
    expectOk(
      await recordReconciliation({
        date: isoDateKeyInKarachi(new Date()),
        counted: "0",
      }),
    );

    const recorded = await actions();

    expect(recorded).toContain("PRODUCT_CREATED");
    expect(recorded).toContain("PRODUCT_UPDATED");
    expect(recorded).toContain("STOCK_ADJUSTED");
    expect(recorded).toContain("SALE_CREATED");
    expect(recorded).toContain("SALE_VOIDED");
    expect(recorded).toContain("PAYMENT_RECORDED");
    expect(recorded).toContain("EXPENSE_RECORDED");
    expect(recorded).toContain("CASH_RECONCILED");

    const voidAudit = await prisma.auditLog.findFirst({
      where: { action: "SALE_VOIDED", entityId: cashSale.id },
    });
    expect(voidAudit?.actor).toBe("local");

    if (!voidAudit?.before || !voidAudit.after) {
      throw new Error("Expected void before and after states");
    }

    expect(JSON.parse(voidAudit.before)).toMatchObject({ voidedAt: null });
    expect(JSON.parse(voidAudit.after)).toMatchObject({
      voidedReason: "Wrong item",
    });

    const updateAudit = await prisma.auditLog.findFirst({
      where: { action: "PRODUCT_UPDATED", entityId: product.id },
    });

    if (!updateAudit?.before || !updateAudit.after) {
      throw new Error("Expected product before and after prices");
    }

    expect(JSON.parse(updateAudit.before)).toMatchObject({
      salePricePaisa: 16000,
    });
    expect(JSON.parse(updateAudit.after)).toMatchObject({
      salePricePaisa: 17000,
    });

    const saleAudit = await prisma.auditLog.findFirst({
      where: { action: "SALE_CREATED", entityId: creditSale.id },
    });
    expect(saleAudit?.summary).toContain(creditSale.number);

    if (!saleAudit?.after) {
      throw new Error("Expected sale after state");
    }

    expect(JSON.parse(saleAudit.after)).toMatchObject({
      khataBalanceAfterPaisa: 17000,
    });
  });

  it("records the signed-in username when one is supplied", async () => {
    const expense = expectOk(
      await createExpense(
        {
          category: "OTHER",
          amount: "25",
          date: isoDateKeyInKarachi(new Date()),
        },
        "owner",
      ),
    );
    const audit = await prisma.auditLog.findFirst({
      where: { action: "EXPENSE_RECORDED", entityId: expense.id },
    });

    expect(audit?.actor).toBe("owner");
  });

  it("writes nothing when a change is rejected", async () => {
    const product = expectOk(await createProduct(sugar));

    const beforeSale = await prisma.auditLog.count();
    const shortSale = await createSale({
      items: [{ productId: product.id, quantity: "999" }],
      paymentMethod: "CASH",
    });
    expect(shortSale.ok).toBe(false);
    expect(await prisma.auditLog.count()).toBe(beforeSale);

    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));
    const creditSale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );
    expectOk(await recordPayment({ customerId: customer.id, amount: "50" }));

    const beforePayment = await prisma.auditLog.count();
    const overPayment = await recordPayment({
      customerId: customer.id,
      amount: "999",
    });
    expect(overPayment.ok).toBe(false);
    expect(await prisma.auditLog.count()).toBe(beforePayment);

    const beforeVoid = await prisma.auditLog.count();
    const rejectedVoid = await voidSale(creditSale.id, {
      reason: "Too late",
    });
    expect(rejectedVoid.ok).toBe(false);
    expect(await prisma.auditLog.count()).toBe(beforeVoid);

    const beforeExpense = await prisma.auditLog.count();
    const badExpense = await createExpense({
      category: "OTHER",
      amount: "0",
      date: "2026-10-26",
    });
    expect(badExpense.ok).toBe(false);
    expect(await prisma.auditLog.count()).toBe(beforeExpense);

    const beforeCash = await prisma.auditLog.count();
    const badCash = await recordReconciliation({
      date: "2026-02-31",
      counted: "100",
    });
    expect(badCash.ok).toBe(false);
    expect(await prisma.auditLog.count()).toBe(beforeCash);
  });
});
