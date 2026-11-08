import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { verifySaleProposalToken } from "@/modules/assistant/proposal-token";
import { runProposeSaleTool } from "@/modules/assistant/sale-proposal";
import { createCustomer } from "@/modules/customers/service";
import { createProduct } from "@/modules/products/service";

const now = new Date("2026-10-28T10:00:00.000Z");
const userId = "user-1";

let shopId: string;

const sugar = {
  name: "Sugar",
  category: "Grocery",
  unit: "kg",
  costPrice: "140",
  salePrice: "160",
  openingStock: "10",
  lowStockLevel: "1",
  barcode: "100001",
  aliases: "Cheeni",
};

const sugarFree = {
  name: "Sugar Free",
  category: "Grocery",
  unit: "packet",
  costPrice: "90",
  salePrice: "120",
  openingStock: "5",
  lowStockLevel: "1",
  barcode: "100003",
  aliases: "",
};

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

async function seedSugar() {
  return expectOk(await createProduct(shopId, sugar));
}

async function propose(args: Record<string, unknown>) {
  return runProposeSaleTool(JSON.stringify(args), { userId, now, shopId });
}

const originalSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-sale-proposals-0123456789";
});

afterAll(async () => {
  if (originalSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalSecret;
  }

  await prisma.$disconnect();
});

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

describe("propose_sale", () => {
  it("prepares a priced cash proposal without writing anything", async () => {
    const product = await seedSugar();
    const salesBefore = await prisma.sale.count();
    const movementsBefore = await prisma.stockMovement.count();

    const result = expectOk(
      await propose({
        items: [{ product: "sugar", quantity: "2" }],
        paymentMethod: "CASH",
        paid: "400",
      }),
    );

    expect(result.proposal.preview.lines).toHaveLength(1);
    expect(result.proposal.preview.lines[0]?.productId).toBe(product.id);
    expect(result.proposal.preview.lines[0]?.quantityMilli).toBe(2000);
    expect(result.proposal.preview.lines[0]?.unitPricePaisa).toBe(16000);
    expect(result.proposal.preview.totalPaisa).toBe(32000);
    expect(result.proposal.preview.paidPaisa).toBe(40000);
    expect(result.proposal.preview.changePaisa).toBe(8000);
    expect(result.model.summary).toContain("Nothing has been saved");
    expect(result.model.summary).not.toContain(result.proposal.token);

    const verified = expectOk(
      verifySaleProposalToken(result.proposal.token, userId, now),
    );

    expect(verified.proposalId).toBe(result.proposal.proposalId);
    expect(verified.preview.totalPaisa).toBe(32000);

    expect(await prisma.sale.count()).toBe(salesBefore);
    expect(await prisma.stockMovement.count()).toBe(movementsBefore);

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(stored?.stockMilli).toBe(10000);
  });

  it("resolves an alias and a barcode to the same product", async () => {
    const product = await seedSugar();

    const byAlias = expectOk(
      await propose({ items: [{ product: "cheeni", quantity: "1" }] }),
    );
    const byBarcode = expectOk(
      await propose({ items: [{ product: "100001", quantity: "1" }] }),
    );

    expect(byAlias.proposal.preview.lines[0]?.productId).toBe(product.id);
    expect(byBarcode.proposal.preview.lines[0]?.productId).toBe(product.id);
  });

  it("uses the customer for a credit proposal", async () => {
    await seedSugar();
    const customer = expectOk(
      await createCustomer(shopId, {
        name: "Ali Khan",
        phone: "0300-1234567",
        note: "",
      }),
    );

    const result = expectOk(
      await propose({
        items: [{ product: "Sugar", quantity: "2" }],
        paymentMethod: "CREDIT",
        customer: "0300 1234567",
      }),
    );

    expect(result.proposal.preview.paymentMethod).toBe("CREDIT");
    expect(result.proposal.preview.customerId).toBe(customer.id);
    expect(result.proposal.preview.customerName).toBe("Ali Khan");
    expect(result.proposal.preview.paidPaisa).toBe(0);
    expect(result.proposal.preview.totalPaisa).toBe(32000);
  });

  it("rejects a credit proposal without a customer", async () => {
    await seedSugar();

    const result = await propose({
      items: [{ product: "Sugar", quantity: "2" }],
      paymentMethod: "CREDIT",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("needs a customer");
    }
  });

  it("rejects an ambiguous product name instead of guessing", async () => {
    await seedSugar();
    expectOk(await createProduct(shopId, sugarFree));

    const result = await propose({
      items: [{ product: "su", quantity: "1" }],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("More than one product matched");
      expect(result.error).toContain("Sugar");
    }
  });

  it("rejects an unknown product and an unknown customer", async () => {
    await seedSugar();

    const product = await propose({
      items: [{ product: "Rice", quantity: "1" }],
    });
    const customer = await propose({
      items: [{ product: "Sugar", quantity: "1" }],
      paymentMethod: "CREDIT",
      customer: "Nobody",
    });

    expect(product.ok).toBe(false);
    expect(customer.ok).toBe(false);

    if (!product.ok) {
      expect(product.error).toContain("No active product matched");
    }

    if (!customer.ok) {
      expect(customer.error).toContain("No customer matched");
    }
  });

  it("rejects a quantity above stock", async () => {
    await seedSugar();

    const result = await propose({
      items: [{ product: "Sugar", quantity: "999" }],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("in stock");
    }
  });
});
