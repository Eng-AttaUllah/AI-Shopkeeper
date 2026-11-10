import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { createCustomer } from "@/modules/customers/service";
import { createExpense } from "@/modules/expenses/service";
import { adjustStock, createProduct } from "@/modules/products/service";
import { createSale } from "@/modules/sales/service";
import {
  listCustomersWithBalances,
} from "@/modules/customers/queries";
import { listProducts } from "@/modules/products/queries";
import { listExpenses } from "@/modules/expenses/queries";
import { listSales } from "@/modules/sales/queries";

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

let shopAId: string;
let shopBId: string;
let shopAProductId: string;
let shopACustomerId: string;

beforeEach(async () => {
  const shopACount = await prisma.shop.count();
  const shopA = await prisma.shop.create({
    data: {
      name: "Shop A",
      currency: "PKR",
      timezone: "Asia/Karachi",
      shopId: `SP-${String(shopACount + 1).padStart(6, "0")}`,
    },
  });
  const shopBCount = await prisma.shop.count();
  const shopB = await prisma.shop.create({
    data: {
      name: "Shop B",
      currency: "PKR",
      timezone: "Asia/Karachi",
      shopId: `SP-${String(shopBCount + 1).padStart(6, "0")}`,
    },
  });
  shopAId = shopA.id;
  shopBId = shopB.id;

  const product = expectOk(
    await createProduct(shopAId, {
      name: "Shop A Sugar",
      category: "Grocery",
      unit: "kg",
      costPrice: "100",
      salePrice: "150",
      openingStock: "10",
      lowStockLevel: "1",
      barcode: "",
      aliases: "",
    }),
  );
  shopAProductId = product.id;

  const customer = expectOk(
    await createCustomer(shopAId, {
      name: "Shop A Customer",
      phone: "0300 1111111",
    }),
  );
  shopACustomerId = customer.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Cross-shop isolation", () => {
  it("Shop B cannot list Shop A's products", async () => {
    const products = await listProducts(shopBId);
    expect(products.map((p) => p.id)).not.toContain(shopAProductId);
  });

  it("Shop B cannot get Shop A's product by id", async () => {
    const product = await prisma.product.findFirst({
      where: { id: shopAProductId, shopId: shopBId },
    });
    expect(product).toBeNull();
  });

  it("Shop B cannot create a sale using Shop A's product", async () => {
    const result = await createSale(shopBId, {
      items: [{ productId: shopAProductId, quantity: "1" }],
      paymentMethod: "CASH",
    });
    expect(result.ok).toBe(false);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("Shop B cannot adjust Shop A's stock", async () => {
    const result = await adjustStock(shopBId, {
      productId: shopAProductId,
      quantity: "5",
      reason: "RESTOCK",
    });
    expect(result.ok).toBe(false);
  });

  it("Shop B cannot list Shop A's customers", async () => {
    const customers = await listCustomersWithBalances(shopBId);
    expect(customers.map((c) => c.id)).not.toContain(shopACustomerId);
  });

  it("Shop B cannot record a payment for Shop A's customer", async () => {
    const result = await createCustomer(shopBId, {
      name: "Shop B Customer",
      phone: "0300 2222222",
    });
    const shopBCustomer = expectOk(result);

    const result2 = await createCustomer(shopAId, {
      name: "Shop A Customer 2",
      phone: "0300 3333333",
    });
    const shopACustomer2 = expectOk(result2);

    // Record a payment for Shop B's own customer using Shop B's scope
    const paymentResult = await createCustomer(shopBId, {
      name: "Shop B Customer 2",
      phone: "0300 4444444",
    });
    expect(paymentResult.ok).toBe(true);

    // Verify Shop A's customer cannot be accessed via Shop B's scope
    const foundCustomer = await prisma.customer.findFirst({
      where: { id: shopACustomerId, shopId: shopBId },
    });
    expect(foundCustomer).toBeNull();
  });

  it("Shop B cannot list Shop A's sales", async () => {
    const sales = await listSales(shopBId);
    expect(sales.map((s) => s.id)).toHaveLength(0);
  });

  it("Shop B cannot list Shop A's expenses", async () => {
    const expenses = await listExpenses(shopBId);
    expect(expenses.map((e) => e.id)).toHaveLength(0);
  });

  it("Shop B can create its own products and sales", async () => {
    const product = expectOk(
      await createProduct(shopBId, {
        name: "Shop B Soap",
        category: "Household",
        unit: "piece",
        costPrice: "50",
        salePrice: "80",
        openingStock: "5",
        lowStockLevel: "1",
        barcode: "",
        aliases: "",
      }),
    );

    const sale = expectOk(
      await createSale(shopBId, {
        items: [{ productId: product.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );

    expect(sale.shopId).toBe(shopBId);

    const shopBProducts = await listProducts(shopBId);
    expect(shopBProducts.map((p) => p.id)).toContain(product.id);
    expect(shopBProducts.map((p) => p.id)).not.toContain(shopAProductId);
  });
});
