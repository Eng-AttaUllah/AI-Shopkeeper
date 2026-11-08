import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { confirmCustomerProposal } from "@/modules/assistant/confirm-customer";
import { confirmProductProposal } from "@/modules/assistant/confirm-product";
import { confirmProductUpdateProposal } from "@/modules/assistant/confirm-product-update";
import { confirmStockAdjustmentProposal } from "@/modules/assistant/confirm-stock-adjustment";
import { runProposeCustomerTool } from "@/modules/assistant/customer-proposal";
import { runProposeProductTool } from "@/modules/assistant/product-proposal";
import { runProposeProductUpdateTool } from "@/modules/assistant/product-update-proposal";
import {
  findProposalTool,
  proposalToolDefinitions,
} from "@/modules/assistant/proposal-tools";
import { runProposeStockAdjustmentTool } from "@/modules/assistant/stock-adjustment-proposal";
import {
  adjustStock,
  createProduct,
  updateProduct,
} from "@/modules/products/service";

const now = new Date("2026-10-29T10:00:00.000Z");
const userId = "user-1";
const actor = "owner";

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

const originalSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-phase-7c-proposals-0123456789";
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
  await prisma.expense.deleteMany();
  await prisma.auditLog.deleteMany();
});

describe("proposal registry", () => {
  it("registers every proposal tool and finds each by name", () => {
    const names = proposalToolDefinitions().map(
      (definition) => definition.function.name,
    );

    expect(names).toEqual([
      "propose_sale",
      "propose_expense",
      "propose_payment",
      "propose_customer",
      "propose_product",
      "propose_product_update",
      "propose_stock_adjustment",
    ]);

    for (const name of names) {
      expect(findProposalTool(name)?.name).toBe(name);
    }
  });
});

describe("customer proposal", () => {
  it("prepares without writing, then confirms once", async () => {
    const prepared = expectOk(
      await runProposeCustomerTool(
        JSON.stringify({
          name: "Ali Khan",
          phone: "0300-1234567",
          note: "Neighbour",
        }),
        { userId, now, shopId },
      ),
    );

    expect(prepared.proposal.preview).toEqual({
      name: "Ali Khan",
      phone: "0300-1234567",
      note: "Neighbour",
    });
    expect(await prisma.customer.count()).toBe(0);

    const confirmed = expectOk(
      await confirmCustomerProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(confirmed.alreadyConfirmed).toBe(false);
    expect(confirmed.customer.proposalId).toBe(
      prepared.proposal.proposalId,
    );
    expect(confirmed.customer.name).toBe("Ali Khan");

    const replay = expectOk(
      await confirmCustomerProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(replay.alreadyConfirmed).toBe(true);
    expect(replay.customer.id).toBe(confirmed.customer.id);
    expect(await prisma.customer.count()).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: confirmed.customer.id, action: "CUSTOMER_CREATED" },
    });

    expect(audit?.actor).toBe(actor);
    expect(audit?.proposalId).toBe(prepared.proposal.proposalId);
    expect(JSON.parse(audit?.details ?? "{}")).toMatchObject({
      source: "assistant_proposal",
    });
  });

  it("refuses a duplicate customer name", async () => {
    await prisma.customer.create({
      data: { name: "Ali Khan", phone: null, note: null, shopId },
    });

    const result = await runProposeCustomerTool(
      JSON.stringify({ name: "Ali Khan" }),
      { userId, now, shopId },
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("already exists");
    }
  });
});

describe("product proposal", () => {
  it("prepares without writing, then creates the product and opening stock", async () => {
    const prepared = expectOk(
      await runProposeProductTool(
        JSON.stringify({
          name: "Rice",
          category: "Grocery",
          unit: "kg",
          costPrice: "250",
          salePrice: "280",
          openingStock: "20",
          lowStockLevel: "2",
          barcode: "200002",
          aliases: "chawal, rice bag",
        }),
        { userId, now, shopId },
      ),
    );

    expect(prepared.proposal.preview).toMatchObject({
      name: "Rice",
      unit: "kg",
      costPricePaisa: 25000,
      salePricePaisa: 28000,
      openingStockMilli: 20000,
      lowStockMilli: 2000,
      barcode: "200002",
      aliases: ["chawal", "rice bag"],
    });
    expect(await prisma.product.count()).toBe(0);

    const confirmed = expectOk(
      await confirmProductProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(confirmed.alreadyConfirmed).toBe(false);
    expect(confirmed.product.proposalId).toBe(
      prepared.proposal.proposalId,
    );
    expect(confirmed.product.stockMilli).toBe(20000);

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: confirmed.product.id, reason: "OPENING" },
    });

    expect(movement?.quantityMilli).toBe(20000);

    const replay = expectOk(
      await confirmProductProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(replay.alreadyConfirmed).toBe(true);
    expect(replay.product.id).toBe(confirmed.product.id);
    expect(await prisma.product.count()).toBe(1);
    expect(await prisma.stockMovement.count()).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: confirmed.product.id, action: "PRODUCT_CREATED" },
    });

    expect(audit?.actor).toBe(actor);
    expect(audit?.proposalId).toBe(prepared.proposal.proposalId);
  });

  it("refuses a duplicate product name", async () => {
    await seedSugar();

    const result = await runProposeProductTool(
      JSON.stringify({
        name: "Sugar",
        unit: "kg",
        costPrice: "140",
        salePrice: "160",
        openingStock: "0",
        lowStockLevel: "1",
      }),
      { userId, now, shopId },
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("already exists");
    }
  });
});

describe("product update proposal", () => {
  it("prepares without writing, then applies the change once", async () => {
    const product = await seedSugar();

    const prepared = expectOk(
      await runProposeProductUpdateTool(
        JSON.stringify({
          product: "Sugar",
          salePrice: "170",
          lowStockLevel: "2",
        }),
        { userId, now, shopId },
      ),
    );

    expect(prepared.proposal.preview.before.salePricePaisa).toBe(16000);
    expect(prepared.proposal.preview.after.salePricePaisa).toBe(17000);
    expect(prepared.proposal.preview.after.lowStockMilli).toBe(2000);

    const unchanged = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(unchanged?.salePricePaisa).toBe(16000);

    const confirmed = expectOk(
      await confirmProductUpdateProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(confirmed.alreadyConfirmed).toBe(false);
    expect(confirmed.product.salePricePaisa).toBe(17000);
    expect(confirmed.product.lowStockMilli).toBe(2000);

    const replay = expectOk(
      await confirmProductUpdateProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(replay.alreadyConfirmed).toBe(true);
    expect(replay.product.id).toBe(product.id);
    expect(
      await prisma.auditLog.count({
        where: {
          action: "PRODUCT_UPDATED",
          proposalId: prepared.proposal.proposalId,
        },
      }),
    ).toBe(1);
  });

  it("rejects a stale proposal after the product changes", async () => {
    const product = await seedSugar();

    const prepared = expectOk(
      await runProposeProductUpdateTool(
        JSON.stringify({ product: "Sugar", salePrice: "170" }),
        { userId, now, shopId },
      ),
    );

    expectOk(
      await updateProduct(shopId, product.id, { ...sugar, salePrice: "165" }, actor),
    );

    const result = await confirmProductUpdateProposal({
      token: prepared.proposal.token,
      userId,
      actor,
      shopId,
      now,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("changed since");
    }

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(stored?.salePricePaisa).toBe(16500);
  });
});

describe("stock adjustment proposal", () => {
  it("prepares without writing, then applies the adjustment once", async () => {
    const product = await seedSugar();

    const prepared = expectOk(
      await runProposeStockAdjustmentTool(
        JSON.stringify({
          product: "Sugar",
          quantity: "5",
          reason: "restock",
          note: "New bag",
        }),
        { userId, now, shopId },
      ),
    );

    expect(prepared.proposal.preview).toMatchObject({
      productId: product.id,
      productName: "Sugar",
      unit: "kg",
      beforeMilli: 10000,
      deltaMilli: 5000,
      afterMilli: 15000,
      reason: "RESTOCK",
      note: "New bag",
    });

    const unchanged = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(unchanged?.stockMilli).toBe(10000);

    const confirmed = expectOk(
      await confirmStockAdjustmentProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(confirmed.alreadyConfirmed).toBe(false);
    expect(confirmed.product.stockMilli).toBe(15000);
    expect(confirmed.movement.proposalId).toBe(
      prepared.proposal.proposalId,
    );
    expect(confirmed.movement.quantityMilli).toBe(5000);

    const replay = expectOk(
      await confirmStockAdjustmentProposal({
        token: prepared.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(replay.alreadyConfirmed).toBe(true);
    expect(replay.product.stockMilli).toBe(15000);
    expect(await prisma.stockMovement.count()).toBe(2);
  });

  it("rejects a stale proposal after stock changes", async () => {
    const product = await seedSugar();

    const prepared = expectOk(
      await runProposeStockAdjustmentTool(
        JSON.stringify({
          product: "Sugar",
          quantity: "5",
          reason: "restock",
        }),
        { userId, now, shopId },
      ),
    );

    expectOk(
      await adjustStock(shopId, {
        productId: product.id,
        quantity: "1",
        reason: "RESTOCK",
      }, actor),
    );

    const result = await confirmStockAdjustmentProposal({
      token: prepared.proposal.token,
      userId,
      actor,
      shopId,
      now,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("changed since");
    }

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(stored?.stockMilli).toBe(11000);
  });

  it("refuses an adjustment that would take stock below zero", async () => {
    await seedSugar();

    const result = await runProposeStockAdjustmentTool(
      JSON.stringify({
        product: "Sugar",
        quantity: "-20",
        reason: "damage",
      }),
      { userId, now, shopId },
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("below zero");
    }
  });
});
