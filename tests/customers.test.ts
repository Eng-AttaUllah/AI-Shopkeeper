import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import {
  createCustomer,
  recordPayment,
  updateCustomer,
} from "@/modules/customers/service";
import {
  buildStatementText,
  customerBalancePaisa,
  customerHistory,
  listCustomersWithBalances,
  totalOutstandingPaisa,
} from "@/modules/customers/queries";
import { createProduct } from "@/modules/products/service";
import { createSale } from "@/modules/sales/service";

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

describe("customers", () => {
  it("creates a customer and finds them by name or phone", async () => {
    const customer = expectOk(
      await createCustomer({
        name: "Ali Khan",
        phone: "0300 1234567",
        note: "Neighbour",
      }),
    );

    expect(customer.name).toBe("Ali Khan");
    expect(customer.phone).toBe("0300 1234567");

    const byName = await listCustomersWithBalances("ali");
    expect(byName).toHaveLength(1);
    expect(byName[0]?.balancePaisa).toBe(0);

    const byPhone = await listCustomersWithBalances("1234567");
    expect(byPhone.map((row) => row.id)).toEqual([customer.id]);
  });

  it("updates a customer and clears an empty note", async () => {
    const customer = expectOk(
      await createCustomer({ name: "Ali Khan", note: "Neighbour" }),
    );

    const updated = expectOk(
      await updateCustomer(customer.id, {
        name: "Ali Khan",
        phone: "0311 2223334",
        note: "",
      }),
    );

    expect(updated.phone).toBe("0311 2223334");
    expect(updated.note).toBeNull();
  });

  it("rejects a short name and a phone with letters", async () => {
    const shortName = await createCustomer({ name: "A" });
    const badPhone = await createCustomer({
      name: "Ali Khan",
      phone: "0300-CALL",
    });

    expect(shortName.ok).toBe(false);
    expect(badPhone.ok).toBe(false);
  });
});

describe("credit sales", () => {
  it("raises the balance by exactly the unpaid amount", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
        paid: "100",
      }),
    );

    expect(sale.paymentMethod).toBe("CREDIT");
    expect(sale.customerId).toBe(customer.id);
    expect(sale.totalPaisa).toBe(32000);
    expect(sale.paidPaisa).toBe(10000);
    expect(sale.changePaisa).toBe(0);
    expect(sale.customer?.name).toBe("Ali Khan");

    expect(await customerBalancePaisa(customer.id)).toBe(22000);

    const stock = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(stock?.stockMilli).toBe(8000);
  });

  it("puts the whole total on the khata when nothing is paid", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );

    expect(sale.paidPaisa).toBe(0);
    expect(await customerBalancePaisa(customer.id)).toBe(32000);
  });

  it("rejects a credit sale without a customer and writes nothing", async () => {
    const product = expectOk(await createProduct(sugar));

    const result = await createSale({
      items: [{ productId: product.id, quantity: "1" }],
      paymentMethod: "CREDIT",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.customerId).toBeDefined();
    }

    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.stockMovement.count({ where: { reason: "SALE" } })).toBe(
      0,
    );
  });

  it("rejects a customer that does not exist", async () => {
    const product = expectOk(await createProduct(sugar));

    const result = await createSale({
      items: [{ productId: product.id, quantity: "1" }],
      paymentMethod: "CREDIT",
      customerId: "missing",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("rejects paying more than the total on a credit sale", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const result = await createSale({
      items: [{ productId: product.id, quantity: "1" }],
      paymentMethod: "CREDIT",
      customerId: customer.id,
      paid: "200",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("does not attach a customer to a cash sale", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const sale = expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CASH",
        customerId: customer.id,
        paid: "160",
      }),
    );

    expect(sale.customerId).toBeNull();
    expect(await customerBalancePaisa(customer.id)).toBe(0);
  });
});

describe("recordPayment", () => {
  it("reduces the balance by exactly the amount paid", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );

    expectOk(
      await recordPayment({
        customerId: customer.id,
        amount: "120",
        note: "Part payment",
      }),
    );

    expect(await customerBalancePaisa(customer.id)).toBe(20000);

    expectOk(
      await recordPayment({ customerId: customer.id, amount: "200" }),
    );

    expect(await customerBalancePaisa(customer.id)).toBe(0);
    expect(await prisma.payment.count()).toBe(2);
  });

  it("rejects a payment above the outstanding balance", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );

    const result = await recordPayment({
      customerId: customer.id,
      amount: "500",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Only Rs. 160.00 is outstanding.");
    }

    expect(await prisma.payment.count()).toBe(0);
    expect(await customerBalancePaisa(customer.id)).toBe(16000);
  });

  it("rejects a payment when nothing is outstanding", async () => {
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const result = await recordPayment({
      customerId: customer.id,
      amount: "10",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.payment.count()).toBe(0);
  });

  it("rejects a zero amount", async () => {
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    const result = await recordPayment({
      customerId: customer.id,
      amount: "0",
    });

    expect(result.ok).toBe(false);
  });
});

describe("balances and history", () => {
  it("totals outstanding across customers", async () => {
    const product = expectOk(await createProduct(sugar));
    const ali = expectOk(await createCustomer({ name: "Ali Khan" }));
    const sara = expectOk(await createCustomer({ name: "Sara Bibi" }));

    expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CREDIT",
        customerId: ali.id,
      }),
    );
    expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: sara.id,
      }),
    );
    expectOk(await recordPayment({ customerId: ali.id, amount: "20" }));

    expect(await totalOutstandingPaisa()).toBe(30000 + 16000);

    const listed = await listCustomersWithBalances();
    expect(listed.map((row) => [row.name, row.balancePaisa])).toEqual([
      ["Ali Khan", 30000],
      ["Sara Bibi", 16000],
    ]);
  });

  it("merges credit sales and payments into one history", async () => {
    const product = expectOk(await createProduct(sugar));
    const customer = expectOk(await createCustomer({ name: "Ali Khan" }));

    expectOk(
      await createSale({
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );

    expectOk(
      await recordPayment({
        customerId: customer.id,
        amount: "50",
        note: "Cash",
      }),
    );

    const history = await customerHistory(customer.id);

    expect(history).toHaveLength(2);
    expect(history[0]?.kind).toBe("payment");
    expect(history[1]?.kind).toBe("sale");

    if (history[0]?.kind === "payment") {
      expect(history[0].amountPaisa).toBe(5000);
      expect(history[0].note).toBe("Cash");
    }
  });

  it("builds a statement with the name and formatted balance", async () => {
    const customer = expectOk(
      await createCustomer({ name: "Ali Khan", phone: "0300 1234567" }),
    );

    const text = buildStatementText({
      shopName: "Demo General Store",
      customer,
      balancePaisa: 125000,
      entries: [],
      now: new Date("2026-10-25T10:00:00Z"),
    });

    expect(text).toContain("Demo General Store — Khata");
    expect(text).toContain("Customer: Ali Khan");
    expect(text).toContain("Phone: 0300 1234567");
    expect(text).toContain("Outstanding: Rs. 1,250.00");
    expect(text).toContain("As of 25 Oct 2026.");
  });
});
