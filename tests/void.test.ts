import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { karachiDayRange } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { customerBalancePaisa } from "@/modules/customers/queries";
import { createCustomer, recordPayment } from "@/modules/customers/service";
import { createProduct } from "@/modules/products/service";
import { productSales, salesSummary } from "@/modules/reports/queries";
import { getSale } from "@/modules/sales/queries";
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

describe("voidSale", () => {
  it("restores stock with a VOID movement and removes the sale from reports", async () => {
    const product = expectOk(await createProduct(sugar));

    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CASH",
      }),
    );

    const before = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(before?.stockMilli).toBe(8000);

    const voided = expectOk(
      await voidSale(sale.id, { reason: "Wrong item entered" }),
    );

    expect(voided.voidedAt).not.toBeNull();
    expect(voided.voidedReason).toBe("Wrong item entered");

    const after = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(after?.stockMilli).toBe(10000);

    const movement = await prisma.stockMovement.findFirst({
      where: { reason: "VOID", reference: sale.id },
    });
    expect(movement?.quantityMilli).toBe(2000);
    expect(movement?.note).toBe("Wrong item entered");

    const summary = await salesSummary(karachiDayRange(new Date()));
    expect(summary.salesCount).toBe(0);
    expect(summary.revenuePaisa).toBe(0);

    const rows = await productSales(karachiDayRange(new Date()));
    expect(rows).toHaveLength(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "SALE_VOIDED", entityId: sale.id },
    });
    expect(audit).not.toBeNull();
  });

  it("restores a credit sale's khata balance to zero", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );

    expect(await customerBalancePaisa(customer.id)).toBe(32000);

    expectOk(await voidSale(sale.id, { reason: "Entered twice" }));

    expect(await customerBalancePaisa(customer.id)).toBe(0);
  });

  it("refuses to void a credit sale after a repayment is applied", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );
    expectOk(await recordPayment({ customerId: customer.id, amount: "50" }));

    const result = await voidSale(sale.id, { reason: "Mistake" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("repayments applied");
    }

    const stored = await getSale(sale.id);
    expect(stored?.voidedAt).toBeNull();

    const productAfter = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(productAfter?.stockMilli).toBe(9000);
    expect(
      await prisma.stockMovement.count({ where: { reason: "VOID" } }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { action: "SALE_VOIDED" } }),
    ).toBe(0);
  });

  it("allows voiding a credit sale that took cash at the counter", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
        paid: "100",
      }),
    );

    expect(await customerBalancePaisa(customer.id)).toBe(6000);
    expectOk(await voidSale(sale.id, { reason: "Returned" }));
    expect(await customerBalancePaisa(customer.id)).toBe(0);
  });

  it("rejects a second void and a missing reason", async () => {
    const product = expectOk(await createProduct(sugar));
    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );

    const missingReason = await voidSale(sale.id, { reason: "" });
    expect(missingReason.ok).toBe(false);

    expectOk(await voidSale(sale.id, { reason: "Wrong price" }));

    const second = await voidSale(sale.id, { reason: "Again" });
    expect(second.ok).toBe(false);

    expect(
      await prisma.auditLog.count({
        where: { action: "SALE_VOIDED", entityId: sale.id },
      }),
    ).toBe(1);
  });
});
