import type { Expense } from "@/generated/prisma/client";
import { writeAudit } from "@/lib/audit";
import { karachiDateKeyToDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import { EXPENSE_CATEGORY_LABELS, expenseSchema } from "./schema";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Record a shop expense.
 *
 * The expense and its audit row are written in one transaction. The date is
 * stored as shop-local midnight so it falls in exactly one report day.
 */
export async function createExpense(input: unknown): Promise<Result<Expense>> {
  const parsed = expenseSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const amountPaisa = rupeesToPaisa(data.amount);

  if (amountPaisa <= 0) {
    return fail("Enter an amount more than zero.", {
      amount: "Must be more than zero",
    });
  }

  const spentAt = karachiDateKeyToDate(data.date);

  if (!spentAt) {
    return fail("Choose a valid date.", { date: "Invalid date" });
  }

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          category: data.category,
          amountPaisa,
          spentAt,
          note: emptyToNull(data.note),
        },
      });

      await writeAudit(tx, {
        action: "EXPENSE_RECORDED",
        entityType: "Expense",
        entityId: created.id,
        summary: `${EXPENSE_CATEGORY_LABELS[data.category]} expense ${formatPaisa(amountPaisa)}`,
        before: null,
        after: {
          category: data.category,
          amountPaisa,
          spentAt: spentAt.toISOString(),
          note: emptyToNull(data.note),
        },
      });

      return created;
    });

    return ok(expense);
  } catch (error) {
    console.error("Expense service error:", error);
    return fail("Something went wrong while saving the expense. Please try again.");
  }
}
