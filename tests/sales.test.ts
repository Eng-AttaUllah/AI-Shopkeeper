import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { createProduct, setProductActive, updateProduct } from "@/modules/products/service";
import {
  getSale,
  listSales,
  saleProfitPaisa,
  saleSubtotalPaisa,
} from "@/modules/sales/queries";
import { createSale } from "@/modules/sales/service";

const sugar = {
  name: "Sugar",
  category: "Grocery",
  unit: "kg",
  costPrice: "140",
  salePrice: "160",
  openingStock: "10",
  lowStockLevel: "1",
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
  lowStockLevel: "2",
  barcode: "100002",
  aliases: "",
};

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

async function seedProducts() {
  const sugarProduct = expectOk(await createProduct(sugar));
  const soapProduct = expectOk(await createProduct(soap));

  return { sugarProduct, soapProduct };
}

beforeEach(async () => {
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createSale", () => {
  it("records a cash sale, decrements stock, and writes one movement per line", async () => {
    const { sugarProduct, soapProduct } = await seedProducts();

    const sale = expectOk(
      await createSale({
        items: [
          { productId: sugarProduct.id, quantity: "2" },
          { productId: soapProduct.id, quantity: "3" },
        ],
        discount: "50",
        paid: "600",
        paymentMethod: "CASH",
      }),
    );

    // 2 kg x 160.00 + 3 x 75.00 = 545.00, less 50.00 discount.
    expect(saleSubtotalPaisa(sale)).toBe(54500);
    expect(sale.totalPaisa).toBe(49500);
    expect(sale.discountPaisa).toBe(5000);
    expect(sale.paidPaisa).toBe(60000);
    expect(sale.changePaisa).toBe(10500);
    expect(sale.number).toMatch(/^\d{8}-0001$/);
    expect(sale.items).toHaveLength(2);

    const updatedSugar = await prisma.product.findUnique({
      where: { id: sugarProduct.id },
    });
    const updatedSoap = await prisma.product.findUnique({
      where: { id: soapProduct.id },
    });

    expect(updatedSugar?.stockMilli).toBe(8000);
    expect(updatedSoap?.stockMilli).toBe(17000);

    const movements = await prisma.stockMovement.findMany({
      where: { reason: "SALE" },
      orderBy: { quantityMilli: "asc" },
    });

    expect(movements).toHaveLength(2);
    expect(movements[0]?.quantityMilli).toBe(-3000);
    expect(movements[1]?.quantityMilli).toBe(-2000);
    expect(movements.every((row) => row.reference === sale.id)).toBe(true);
  });

  it("snapshots the unit price and cost on every line", async () => {
    const { sugarProduct } = await seedProducts();

    const sale = expectOk(
      await createSale({
        items: [{ productId: sugarProduct.id, quantity: "2" }],
        paymentMethod: "CASH",
      }),
    );

    expect(sale.items[0]?.productName).toBe("Sugar");
    expect(sale.items[0]?.unit).toBe("kg");
    expect(sale.items[0]?.unitPricePaisa).toBe(16000);
    expect(sale.items[0]?.unitCostPaisa).toBe(14000);
    expect(sale.items[0]?.lineTotalPaisa).toBe(32000);
    expect(sale.items[0]?.lineCostPaisa).toBe(28000);
  });

  it("keeps the snapshot after product prices change", async () => {
    const { sugarProduct } = await seedProducts();

    const sale = expectOk(
      await createSale({
        items: [{ productId: sugarProduct.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );

    expectOk(
      await updateProduct(sugarProduct.id, {
        ...sugar,
        salePrice: "200",
        costPrice: "180",
      }),
    );

    const stored = await getSale(sale.id);

    expect(stored?.items[0]?.unitPricePaisa).toBe(16000);
    expect(stored?.items[0]?.unitCostPaisa).toBe(14000);
    expect(stored && saleProfitPaisa(stored)).toBe(2000);
  });

  it("merges duplicate lines for the same product", async () => {
    const { sugarProduct } = await seedProducts();

    const sale = expectOk(
      await createSale({
        items: [
          { productId: sugarProduct.id, quantity: "1" },
          { productId: sugarProduct.id, quantity: "2" },
        ],
        paymentMethod: "CASH",
      }),
    );

    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]?.quantityMilli).toBe(3000);

    const updated = await prisma.product.findUnique({
      where: { id: sugarProduct.id },
    });
    expect(updated?.stockMilli).toBe(7000);
  });

  it("supports fractional quantities and rounds line totals to paisa", async () => {
    const { sugarProduct } = await seedProducts();

    const sale = expectOk(
      await createSale({
        items: [{ productId: sugarProduct.id, quantity: "1.5" }],
        paymentMethod: "CASH",
      }),
    );

    expect(sale.items[0]?.quantityMilli).toBe(1500);
    expect(sale.items[0]?.lineTotalPaisa).toBe(24000);

    const updated = await prisma.product.findUnique({
      where: { id: sugarProduct.id },
    });
    expect(updated?.stockMilli).toBe(8500);
  });

  it("rejects a sale above the available stock and writes nothing", async () => {
    const { sugarProduct } = await seedProducts();

    const result = await createSale({
      items: [{ productId: sugarProduct.id, quantity: "11" }],
      paymentMethod: "CASH",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Only 10 kg of Sugar in stock.");
    }

    expect(await prisma.sale.count()).toBe(0);
    expect(
      await prisma.stockMovement.count({ where: { reason: "SALE" } }),
    ).toBe(0);

    const unchanged = await prisma.product.findUnique({
      where: { id: sugarProduct.id },
    });
    expect(unchanged?.stockMilli).toBe(10000);
  });

  it("rolls back every line when one product is short", async () => {
    const { sugarProduct, soapProduct } = await seedProducts();

    const result = await createSale({
      items: [
        { productId: sugarProduct.id, quantity: "2" },
        { productId: soapProduct.id, quantity: "100" },
      ],
      paymentMethod: "CASH",
    });

    expect(result.ok).toBe(false);

    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.saleItem.count()).toBe(0);

    const sugarAfter = await prisma.product.findUnique({
      where: { id: sugarProduct.id },
    });
    expect(sugarAfter?.stockMilli).toBe(10000);
  });

  it("rejects a product that is no longer on sale", async () => {
    const { soapProduct } = await seedProducts();
    expectOk(await setProductActive(soapProduct.id, false));

    const result = await createSale({
      items: [{ productId: soapProduct.id, quantity: "1" }],
      paymentMethod: "CASH",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Soap is not on sale.");
    }
    expect(await prisma.sale.count()).toBe(0);
  });

  it("rejects a discount larger than the subtotal", async () => {
    const { sugarProduct } = await seedProducts();

    const result = await createSale({
      items: [{ productId: sugarProduct.id, quantity: "1" }],
      discount: "500",
      paymentMethod: "CASH",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.discount).toBeDefined();
    }
  });

  it("rejects cash below the total", async () => {
    const { sugarProduct } = await seedProducts();

    const result = await createSale({
      items: [{ productId: sugarProduct.id, quantity: "1" }],
      paid: "100",
      paymentMethod: "CASH",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.paid).toBeDefined();
    }
  });

  it("rejects a zero quantity and an empty cart", async () => {
    const { sugarProduct } = await seedProducts();

    const zero = await createSale({
      items: [{ productId: sugarProduct.id, quantity: "0" }],
      paymentMethod: "CASH",
    });
    const empty = await createSale({ items: [], paymentMethod: "CASH" });

    expect(zero.ok).toBe(false);
    expect(empty.ok).toBe(false);
  });

  it("numbers sales in order within the shop's day", async () => {
    const { sugarProduct } = await seedProducts();

    const first = expectOk(
      await createSale({
        items: [{ productId: sugarProduct.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );
    const second = expectOk(
      await createSale({
        items: [{ productId: sugarProduct.id, quantity: "1" }],
        paymentMethod: "CASH",
      }),
    );

    expect(first.number.endsWith("-0001")).toBe(true);
    expect(second.number.endsWith("-0002")).toBe(true);

    const sales = await listSales();
    expect(sales).toHaveLength(2);
    expect(sales[0]?.id).toBe(second.id);
    expect(sales[0]?._count.items).toBe(1);
  });

  it("computes profit from snapshots after a discount", async () => {
    const { sugarProduct } = await seedProducts();

    const sale = expectOk(
      await createSale({
        items: [{ productId: sugarProduct.id, quantity: "2" }],
        discount: "10",
        paymentMethod: "CASH",
      }),
    );

    expect(saleSubtotalPaisa(sale)).toBe(32000);
    expect(saleProfitPaisa(sale)).toBe(3000);
  });
});
