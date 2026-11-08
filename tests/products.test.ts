import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  listProducts,
  lowStockProducts,
  reconcileStock,
} from "@/modules/products/queries";
import {
  adjustStock,
  createProduct,
  setProductActive,
  updateProduct,
} from "@/modules/products/service";
import type { Result } from "@/lib/result";

const sugar = {
  name: "Sugar",
  category: "Grocery",
  unit: "kg",
  costPrice: "140",
  salePrice: "160",
  openingStock: "100",
  lowStockLevel: "10",
  barcode: "100001",
  aliases: "شکر, cheeni",
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

describe("createProduct", () => {
  it("creates a product with opening stock and a movement", async () => {
    const product = expectOk(await createProduct(shopId, sugar));

    expect(product.name).toBe("Sugar");
    expect(product.stockMilli).toBe(100000);
    expect(product.costPricePaisa).toBe(14000);
    expect(product.salePricePaisa).toBe(16000);
    expect(product.lowStockMilli).toBe(10000);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id },
    });

    expect(movements).toHaveLength(1);
    expect(movements[0]?.reason).toBe("OPENING");
    expect(movements[0]?.quantityMilli).toBe(100000);
  });

  it("rejects a duplicate name regardless of case and spacing", async () => {
    expectOk(await createProduct(shopId, sugar));

    const result = await createProduct(shopId, { ...sugar, name: "   sugar  " });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.name).toBeDefined();
    }
  });

  it("rejects a duplicate barcode", async () => {
    expectOk(await createProduct(shopId, sugar));

    const result = await createProduct(shopId, {
      ...sugar,
      name: "Sugar (fine)",
      barcode: "100001",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.barcode).toBeDefined();
    }
  });

  it("rejects a negative or malformed price", async () => {
    const negative = await createProduct(shopId, { ...sugar, salePrice: "-5" });
    const threeDecimals = await createProduct(shopId, {
      ...sugar,
      salePrice: "160.555",
    });

    expect(negative.ok).toBe(false);
    expect(threeDecimals.ok).toBe(false);
  });

  it("stores aliases and finds the product by an alias", async () => {
    const product = expectOk(await createProduct(shopId, sugar));

    expect(product.id).toBeTruthy();

    const aliases = await prisma.productAlias.findMany({
      where: { productId: product.id },
    });
    expect(aliases.map((row) => row.alias).sort()).toEqual(
      ["cheeni", "شکر"].sort(),
    );

    const found = await listProducts(shopId, { search: "cheeni" });
    expect(found).toHaveLength(1);
    expect(found[0]?.name).toBe("Sugar");
  });
});

describe("updateProduct", () => {
  it("changes prices without touching stock", async () => {
    const created = expectOk(await createProduct(shopId, sugar));

    const updated = expectOk(
      await updateProduct(shopId, created.id, {
        ...sugar,
        salePrice: "175",
      }),
    );

    expect(updated.salePricePaisa).toBe(17500);
    expect(updated.stockMilli).toBe(created.stockMilli);
  });
});

describe("setProductActive", () => {
  it("hides a deactivated product from the list but keeps the record", async () => {
    const created = expectOk(await createProduct(shopId, sugar));

    expectOk(await setProductActive(shopId, created.id, false));

    expect(await listProducts(shopId)).toHaveLength(0);
    expect(
      await listProducts(shopId, { includeInactive: true }),
    ).toHaveLength(1);
    expect(await prisma.product.count()).toBe(1);
  });
});

describe("adjustStock", () => {
  it("adds stock and records a movement", async () => {
    const created = expectOk(await createProduct(shopId, sugar));

    const updated = expectOk(
      await adjustStock(shopId, {
        productId: created.id,
        quantity: "25.5",
        reason: "RESTOCK",
        note: "Delivery",
      }),
    );

    expect(updated.stockMilli).toBe(125500);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: created.id, reason: "RESTOCK" },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantityMilli).toBe(25500);
  });

  it("refuses to take stock below zero", async () => {
    const created = expectOk(
      await createProduct(shopId, { ...sugar, openingStock: "5" }),
    );

    const result = await adjustStock(shopId, {
      productId: created.id,
      quantity: "-6",
      reason: "DAMAGE",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Only 5 kg in stock");
    }

    const unchanged = await prisma.product.findUnique({
      where: { id: created.id },
    });
    expect(unchanged?.stockMilli).toBe(5000);
    expect(
      await prisma.stockMovement.count({ where: { productId: created.id } }),
    ).toBe(1);
  });

  it("rejects a zero change", async () => {
    const created = expectOk(await createProduct(shopId, sugar));

    const result = await adjustStock(shopId, {
      productId: created.id,
      quantity: "0",
      reason: "CORRECTION",
    });

    expect(result.ok).toBe(false);
  });
});

describe("lowStockProducts", () => {
  it("includes products at or below their low-stock level", async () => {
    expectOk(
      await createProduct(shopId, { ...sugar, openingStock: "5" }),
    );
    expectOk(
      await createProduct(shopId, {
        ...sugar,
        name: "Rice",
        barcode: "",
        aliases: "",
        openingStock: "50",
      }),
    );

    const low = await lowStockProducts(shopId);

    expect(low.map((product) => product.name)).toEqual(["Sugar"]);
  });
});

describe("reconcileStock", () => {
  it("reports no drift after normal operations", async () => {
    const created = expectOk(await createProduct(shopId, sugar));
    expectOk(
      await adjustStock(shopId, {
        productId: created.id,
        quantity: "-3.5",
        reason: "DAMAGE",
      }),
    );

    expect(await reconcileStock(shopId)).toEqual([]);
  });

  it("detects a cached stock value that does not match the movements", async () => {
    const created = expectOk(await createProduct(shopId, sugar));

    await prisma.product.update({
      where: { id: created.id },
      data: { stockMilli: 1 },
    });

    const drift = await reconcileStock(shopId);

    expect(drift).toHaveLength(1);
    expect(drift[0]?.computedMilli).toBe(100000);
    expect(drift[0]?.cachedMilli).toBe(1);
  });
});
