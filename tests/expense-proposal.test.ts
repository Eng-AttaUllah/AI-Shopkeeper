import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { isoDateKeyInKarachi, karachiDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { confirmExpenseProposal } from "@/modules/assistant/confirm-expense";
import { verifyExpenseProposalToken } from "@/modules/assistant/proposal-token";
import { runProposeExpenseTool } from "@/modules/assistant/expense-proposal";

const now = new Date("2026-10-28T10:00:00.000Z");
const userId = "user-1";
const actor = "owner";

let shopId: string;

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

async function propose(args: Record<string, unknown>) {
  return runProposeExpenseTool(JSON.stringify(args), { userId, now, shopId });
}

const originalSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-expense-proposals-0123456789";
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

  await prisma.expense.deleteMany();
  await prisma.auditLog.deleteMany();
});

describe("propose_expense", () => {
  it("prepares an expense proposal without writing anything", async () => {
    const result = expectOk(
      await propose({
        category: "electricity",
        amount: "500",
        note: "October bill",
      }),
    );

    expect(result.proposal.preview).toMatchObject({
      category: "ELECTRICITY",
      amountPaisa: 50000,
      date: isoDateKeyInKarachi(now),
      note: "October bill",
    });
    expect(result.model.summary).toContain("Nothing has been saved");
    expect(result.model.summary).toContain("Rs. 500.00");
    expect(result.model.summary).toContain("Electricity");
    expect(result.model.summary).not.toContain(result.proposal.token);

    const verified = expectOk(
      verifyExpenseProposalToken(result.proposal.token, userId, now),
    );

    expect(verified.kind).toBe("expense");
    expect(verified.proposalId).toBe(result.proposal.proposalId);
    expect(verified.preview).toEqual(result.proposal.preview);

    expect(await prisma.expense.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("accepts a category alias and an explicit shop date", async () => {
    const result = expectOk(
      await propose({
        category: "shop rent",
        amount: "1500",
        date: "2026-10-27",
      }),
    );

    expect(result.proposal.preview.category).toBe("RENT");
    expect(result.proposal.preview.date).toBe("2026-10-27");
  });

  it("rejects zero, bad dates, unknown categories, and bad amounts", async () => {
    const zero = await propose({
      category: "other",
      amount: "0",
      date: "2026-10-28",
    });
    const badDate = await propose({
      category: "other",
      amount: "10",
      date: "2026-02-31",
    });
    const badCategory = await propose({
      category: "food",
      amount: "10",
      date: "2026-10-28",
    });
    const badAmount = await propose({
      category: "other",
      amount: "ten",
      date: "2026-10-28",
    });

    expect(zero.ok).toBe(false);
    expect(badDate.ok).toBe(false);
    expect(badCategory.ok).toBe(false);
    expect(badAmount.ok).toBe(false);
    expect(await prisma.expense.count()).toBe(0);
  });
});

describe("confirmExpenseProposal", () => {
  it("records the expense and audit row, and replays idempotently", async () => {
    const proposal = expectOk(
      await propose({
        category: "transport",
        amount: "250.50",
        date: "2026-10-27",
        note: "Fare",
      }),
    );

    const first = expectOk(
      await confirmExpenseProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(first.alreadyConfirmed).toBe(false);
    expect(first.expense.proposalId).toBe(proposal.proposal.proposalId);
    expect(first.expense.category).toBe("TRANSPORT");
    expect(first.expense.amountPaisa).toBe(25050);
    expect(first.expense.spentAt.getTime()).toBe(
      karachiDateTime(2026, 10, 27).getTime(),
    );
    expect(first.expense.note).toBe("Fare");

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: first.expense.id, action: "EXPENSE_RECORDED" },
    });

    expect(audit?.actor).toBe(actor);
    expect(JSON.parse(audit?.details ?? "{}")).toMatchObject({
      source: "assistant_proposal",
      proposalId: proposal.proposal.proposalId,
    });

    const second = expectOk(
      await confirmExpenseProposal({
        token: proposal.proposal.token,
        userId,
        actor,
        shopId,
        now,
      }),
    );

    expect(second.alreadyConfirmed).toBe(true);
    expect(second.expense.id).toBe(first.expense.id);
    expect(await prisma.expense.count()).toBe(1);
    expect(await prisma.auditLog.count()).toBe(1);
  });

  it("rejects a wrong user, an expired token, and a tampered token", async () => {
    const proposal = expectOk(
      await propose({
        category: "other",
        amount: "10",
        date: "2026-10-28",
      }),
    );

    const wrongUser = await confirmExpenseProposal({
      token: proposal.proposal.token,
      userId: "user-2",
      actor,
      shopId,
      now,
    });
    const expired = await confirmExpenseProposal({
      token: proposal.proposal.token,
      userId,
      actor,
      shopId,
      now: new Date(now.getTime() + 16 * 60 * 1000),
    });
    const [encoded, signature] = proposal.proposal.token.split(".");
    const tampered = await confirmExpenseProposal({
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

    expect(await prisma.expense.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
