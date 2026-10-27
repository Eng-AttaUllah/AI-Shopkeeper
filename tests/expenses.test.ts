import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { karachiDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { expenseTotalPaisa, listExpenses } from "@/modules/expenses/queries";
import { createExpense } from "@/modules/expenses/service";

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.expense.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createExpense", () => {
  it("records an expense at shop-local midnight and writes an audit row", async () => {
    const expense = expectOk(
      await createExpense({
        category: "RENT",
        amount: "1500",
        date: "2026-10-26",
        note: "October rent",
      }),
    );

    expect(expense.amountPaisa).toBe(150000);
    expect(expense.category).toBe("RENT");
    expect(expense.note).toBe("October rent");
    expect(expense.spentAt.getTime()).toBe(
      karachiDateTime(2026, 10, 26).getTime(),
    );

    const audit = await prisma.auditLog.findFirst({
      where: { action: "EXPENSE_RECORDED", entityId: expense.id },
    });

    expect(audit).not.toBeNull();
    expect(audit?.summary).toContain("Rs. 1,500.00");
    expect(audit?.actor).toBe("local");

    if (!audit?.after) {
      throw new Error("Expected audit after state");
    }

    expect(JSON.parse(audit.after)).toMatchObject({
      category: "RENT",
      amountPaisa: 150000,
    });
  });

  it("totals only the expenses inside the range", async () => {
    expectOk(
      await createExpense({
        category: "RENT",
        amount: "1000",
        date: "2026-09-30",
      }),
    );
    expectOk(
      await createExpense({
        category: "ELECTRICITY",
        amount: "250",
        date: "2026-10-01",
      }),
    );
    expectOk(
      await createExpense({
        category: "OTHER",
        amount: "50",
        date: "2026-10-31",
      }),
    );

    const october = await expenseTotalPaisa(prisma, {
      start: karachiDateTime(2026, 10, 1),
      end: karachiDateTime(2026, 11, 1),
    });

    expect(october).toBe(30000);
  });

  it("lists newest expense dates first", async () => {
    expectOk(
      await createExpense({
        category: "OTHER",
        amount: "10",
        date: "2026-10-01",
      }),
    );
    const later = expectOk(
      await createExpense({
        category: "OTHER",
        amount: "20",
        date: "2026-10-05",
      }),
    );

    const expenses = await listExpenses();

    expect(expenses[0]?.id).toBe(later.id);
  });

  it("rejects zero, a bad date, an unknown category, and a bad amount", async () => {
    const zero = await createExpense({
      category: "OTHER",
      amount: "0",
      date: "2026-10-26",
    });
    const badDate = await createExpense({
      category: "OTHER",
      amount: "10",
      date: "2026-02-31",
    });
    const badCategory = await createExpense({
      category: "FOOD",
      amount: "10",
      date: "2026-10-26",
    });
    const badAmount = await createExpense({
      category: "OTHER",
      amount: "ten",
      date: "2026-10-26",
    });

    expect(zero.ok).toBe(false);
    expect(badDate.ok).toBe(false);
    expect(badCategory.ok).toBe(false);
    expect(badAmount.ok).toBe(false);
    expect(await prisma.expense.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
