import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { confirmPaymentProposal } from "@/modules/assistant/confirm-payment";
import { verifyPaymentProposalToken } from "@/modules/assistant/proposal-token";
import { runProposePaymentTool } from "@/modules/assistant/payment-proposal";
import { customerBalancePaisa } from "@/modules/customers/queries";
import {
  createCustomer,
  recordPayment,
} from "@/modules/customers/service";
import { createProduct } from "@/modules/products/service";
import { createSale } from "@/modules/sales/service";

const now = new Date("2026-10-28T10:00:00.000Z");
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
  barcode: "",
  aliases: "",
};

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

async function propose(args: Record<string, unknown>) {
  return runProposePaymentTool(JSON.stringify(args), { userId, now, shopId });
}

async function seedCreditCustomer() {
  const product = expectOk(await createProduct(shopId, sugar));
  const customer = expectOk(
    await createCustomer(shopId, {
      name: "Ali Khan",
      phone: "0300-1234567",
      note: "",
    }),
  );

  expectOk(
    await createSale(shopId, {
      items: [{ productId: product.id, quantity: "2" }],
      paymentMethod: "CREDIT",
      customerId: customer.id,
    }),
  );

  return { product, customer };
}

const originalSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-payment-proposals-0123456789";
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
  const shopCount = await prisma.shop.count();
  const shop = await prisma.shop.create({
    data: {
      name: "Test Shop",
      currency: "PKR",
      timezone: "Asia/Karachi",
      shopId: `SP-${String(shopCount + 1).padStart(6, "0")}`,
    },
  });
  shopId = shop.id;

  await prisma.auditLog.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.product.deleteMany();
});

describe("propose_payment", () => {
  it("prepares a repayment proposal with the current khata balance", async () => {
    const { customer } = await seedCreditCustomer();

    const result = expectOk(
      await propose({
        customer: "Ali Khan",
        amount: "120",
        note: "Part payment",
      }),
    );

    expect(result.proposal.preview).toMatchObject({
      customerId: customer.id,
      customerName: "Ali Khan",
      amountPaisa: 12000,
      balanceBeforePaisa: 32000,
      balanceAfterPaisa: 20000,
      note: "Part payment",
    });
    expect(result.model.summary).toContain("Nothing has been saved");
    expect(result.model.summary).toContain("Rs. 120.00");
    expect(result.model.summary).not.toContain(result.proposal.token);

    const verified = expectOk(
      verifyPaymentProposalToken(result.proposal.token, userId, now),
    );

    expect(verified.kind).toBe("payment");
    expect(verified.proposalId).toBe(result.proposal.proposalId);
    expect(verified.preview).toEqual(result.proposal.preview);

    expect(await prisma.payment.count()).toBe(0);
    expect(await customerBalancePaisa(shopId, customer.id)).toBe(32000);
  });

  it("matches a customer by phone", async () => {
    const { customer } = await seedCreditCustomer();

    const result = expectOk(
      await propose({ customer: "0300 1234567", amount: "10" }),
    );

    expect(result.proposal.preview.customerId).toBe(customer.id);
  });

  it("rejects unknown customers, no balance, overpayment, and zero", async () => {
    const { customer } = await seedCreditCustomer();
    const noBalance = expectOk(
      await createCustomer(shopId, { name: "Sara Bibi" }),
    );

    const unknown = await propose({ customer: "Nobody", amount: "10" });
    const empty = await propose({ customer: "Sara Bibi", amount: "10" });
    const over = await propose({ customer: "Ali Khan", amount: "500" });
    const zero = await propose({ customer: "Ali Khan", amount: "0" });

    expect(unknown.ok).toBe(false);
    expect(empty.ok).toBe(false);
    expect(over.ok).toBe(false);
    expect(zero.ok).toBe(false);

    if (!unknown.ok) {
      expect(unknown.error).toContain("No customer matched");
    }

    if (!empty.ok) {
      expect(empty.error).toContain("no outstanding balance");
    }

    if (!over.ok) {
      expect(over.error).toContain("Only Rs. 320.00 is outstanding.");
    }

    expect(await prisma.payment.count()).toBe(0);
    expect(await customerBalancePaisa(shopId, customer.id)).toBe(32000);
    expect(await customerBalancePaisa(shopId, noBalance.id)).toBe(0);
  });
});

describe("confirmPaymentProposal", () => {
  it("records the repayment, reduces the khata, and replays idempotently", async () => {
    const { customer } = await seedCreditCustomer();
    const proposal = expectOk(
      await propose({ customer: "Ali Khan", amount: "120" }),
    );

    const first = expectOk(
      await confirmPaymentProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(first.alreadyConfirmed).toBe(false);
    expect(first.payment.proposalId).toBe(proposal.proposal.proposalId);
    expect(first.payment.amountPaisa).toBe(12000);
    expect(first.customerName).toBe("Ali Khan");
    expect(await customerBalancePaisa(shopId, customer.id)).toBe(20000);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: first.payment.id, action: "PAYMENT_RECORDED" },
    });

    expect(audit?.actor).toBe(actor);
    expect(JSON.parse(audit?.details ?? "{}")).toMatchObject({
      source: "assistant_proposal",
      proposalId: proposal.proposal.proposalId,
    });

    const second = expectOk(
      await confirmPaymentProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(second.alreadyConfirmed).toBe(true);
    expect(second.payment.id).toBe(first.payment.id);
    expect(await prisma.payment.count()).toBe(1);
    expect(await customerBalancePaisa(shopId, customer.id)).toBe(20000);
  });

  it("refuses to write when the khata balance changed", async () => {
    const { customer } = await seedCreditCustomer();
    const proposal = expectOk(
      await propose({ customer: "Ali Khan", amount: "120" }),
    );

    expectOk(
      await recordPayment(shopId, { customerId: customer.id, amount: "100" }),
    );

    const result = await confirmPaymentProposal({
      token: proposal.proposal.token,
      userId,
      actor,
      shopId,
      now,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("khata balance changed");
    }

    expect(await prisma.payment.count()).toBe(1);
    expect(await customerBalancePaisa(shopId, customer.id)).toBe(22000);
  });

  it("returns the original payment on replay even after a later repayment", async () => {
    const { customer } = await seedCreditCustomer();
    const proposal = expectOk(
      await propose({ customer: "Ali Khan", amount: "120" }),
    );

    const first = expectOk(
      await confirmPaymentProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expectOk(
      await recordPayment(shopId, { customerId: customer.id, amount: "100" }),
    );

    const replay = expectOk(
      await confirmPaymentProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(replay.alreadyConfirmed).toBe(true);
    expect(replay.payment.id).toBe(first.payment.id);
    expect(await prisma.payment.count()).toBe(2);
    expect(await customerBalancePaisa(shopId, customer.id)).toBe(10000);
  });

  it("rejects a wrong user, an expired token, and a tampered token", async () => {
    const { customer } = await seedCreditCustomer();
    const proposal = expectOk(
      await propose({ customer: "Ali Khan", amount: "120" }),
    );

    const wrongUser = await confirmPaymentProposal({
      token: proposal.proposal.token,
      userId: "user-2",
      actor,
      shopId,
      now,
    });
    const expired = await confirmPaymentProposal({
      token: proposal.proposal.token,
      userId,
      actor,
      shopId,
      now: new Date(now.getTime() + 16 * 60 * 1000),
    });
    const [encoded, signature] = proposal.proposal.token.split(".");
    const tampered = await confirmPaymentProposal({
      token: `${encoded?.slice(0, -1)}A.${signature}`,
      userId,
      actor,
      shopId,
      now,
    });

    expect(wrongUser.ok).toBe(false);
    expect(expired.ok).toBe(false);
    expect(tampered.ok).toBe(false);

    if (!wrongUser.ok) {
      expect(wrongUser.error).toContain("different sign-in");
    }

    if (!expired.ok) {
      expect(expired.error).toContain("expired");
    }

    expect(await prisma.payment.count()).toBe(0);
    expect(await customerBalancePaisa(shopId, customer.id)).toBe(32000);
  });
});
