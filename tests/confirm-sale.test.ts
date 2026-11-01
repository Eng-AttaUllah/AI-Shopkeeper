import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { confirmSaleProposal } from "@/modules/assistant/confirm-sale";
import { runProposeSaleTool } from "@/modules/assistant/sale-proposal";
import { outstandingPaisa } from "@/modules/customers/balance";
import { createCustomer } from "@/modules/customers/service";
import { createProduct } from "@/modules/products/service";

const now = new Date("2026-10-28T10:00:00.000Z");
const userId = "user-1";
const actor = "owner";

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
  return expectOk(await createProduct(sugar));
}

async function prepare(args: Record<string, unknown> = {}) {
  return runProposeSaleTool(
    JSON.stringify({
      items: [{ product: "Sugar", quantity: "2" }],
      paymentMethod: "CASH",
      paid: "320",
      ...args,
    }),
    { userId, now },
  );
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
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.product.deleteMany();
  await prisma.auditLog.deleteMany();
});

describe("confirmSaleProposal", () => {
  it("records the confirmed sale, stock movement, and audit actor", async () => {
    const product = await seedSugar();
    const proposal = expectOk(await prepare());

    const outcome = expectOk(
      await confirmSaleProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        now,
      }),
    );

    expect(outcome.alreadyConfirmed).toBe(false);
    expect(outcome.sale.proposalId).toBe(proposal.proposal.proposalId);
    expect(outcome.sale.totalPaisa).toBe(32000);
    expect(outcome.sale.paidPaisa).toBe(32000);
    expect(outcome.sale.items).toHaveLength(1);

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(stored?.stockMilli).toBe(8000);

    const movement = await prisma.stockMovement.findFirst({
      where: { reference: outcome.sale.id, reason: "SALE" },
    });

    expect(movement?.quantityMilli).toBe(-2000);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: outcome.sale.id, action: "SALE_CREATED" },
    });

    expect(audit?.actor).toBe(actor);
    expect(JSON.parse(audit?.details ?? "{}")).toMatchObject({
      source: "assistant_proposal",
    });
  });

  it("returns the same sale when the same proposal is confirmed twice", async () => {
    await seedSugar();
    const proposal = expectOk(await prepare());

    const first = expectOk(
      await confirmSaleProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        now,
      }),
    );
    const second = expectOk(
      await confirmSaleProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        now,
      }),
    );

    expect(first.alreadyConfirmed).toBe(false);
    expect(second.alreadyConfirmed).toBe(true);
    expect(second.sale.id).toBe(first.sale.id);
    expect(await prisma.sale.count()).toBe(1);

    const product = await prisma.product.findFirst({
      where: { name: "Sugar" },
    });

    expect(product?.stockMilli).toBe(8000);
  });

  it("refuses to write when the price changed after the proposal", async () => {
    const product = await seedSugar();
    // Let cash received default to the total, so the changed price reaches the
    // preview comparison instead of failing the cash check first.
    const proposal = expectOk(await prepare({ paid: undefined }));

    await prisma.product.update({
      where: { id: product.id },
      data: { salePricePaisa: 17000 },
    });

    const result = await confirmSaleProposal({
      token: proposal.proposal.token,
      userId,
      actor,
      now,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("Prices or stock changed");
    }

    expect(await prisma.sale.count()).toBe(0);
  });

  it("refuses to write when stock is no longer enough", async () => {
    const product = await seedSugar();
    const proposal = expectOk(await prepare());

    await prisma.product.update({
      where: { id: product.id },
      data: { stockMilli: 1000 },
    });

    const result = await confirmSaleProposal({
      token: proposal.proposal.token,
      userId,
      actor,
      now,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("in stock");
    }

    expect(await prisma.sale.count()).toBe(0);
  });

  it("rejects a proposal prepared for another user", async () => {
    await seedSugar();
    const proposal = expectOk(await prepare());

    const result = await confirmSaleProposal({
      token: proposal.proposal.token,
      userId: "user-2",
      actor,
      now,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("different sign-in");
    }

    expect(await prisma.sale.count()).toBe(0);
  });

  it("rejects an expired proposal", async () => {
    await seedSugar();
    const proposal = expectOk(await prepare());

    const result = await confirmSaleProposal({
      token: proposal.proposal.token,
      userId,
      actor,
      now: new Date(now.getTime() + 16 * 60 * 1000),
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("expired");
    }

    expect(await prisma.sale.count()).toBe(0);
  });

  it("rejects a tampered token", async () => {
    await seedSugar();
    const proposal = expectOk(await prepare());
    const [encoded, signature] = proposal.proposal.token.split(".");
    const tampered = `${encoded?.slice(0, -1)}A.${signature}`;

    const result = await confirmSaleProposal({
      token: tampered,
      userId,
      actor,
      now,
    });

    expect(result.ok).toBe(false);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("records a credit sale and updates the khata balance", async () => {
    await seedSugar();
    const customer = expectOk(
      await createCustomer({
        name: "Ali Khan",
        phone: "0300-1234567",
        note: "",
      }),
    );
    const proposal = expectOk(
      await prepare({
        paymentMethod: "CREDIT",
        customer: "Ali Khan",
        paid: undefined,
      }),
    );

    const outcome = expectOk(
      await confirmSaleProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        now,
      }),
    );

    expect(outcome.sale.paymentMethod).toBe("CREDIT");
    expect(outcome.sale.customerId).toBe(customer.id);
    expect(outcome.sale.paidPaisa).toBe(0);
    expect(await outstandingPaisa(prisma, customer.id)).toBe(32000);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: outcome.sale.id, action: "SALE_CREATED" },
    });
    const after = JSON.parse(audit?.after ?? "{}");

    expect(after.khataBalanceBeforePaisa).toBe(0);
    expect(after.khataBalanceAfterPaisa).toBe(32000);
  });
});
