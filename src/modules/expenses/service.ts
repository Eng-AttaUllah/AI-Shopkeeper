import { Prisma } from "@/generated/prisma/client";
import type { Expense } from "@/generated/prisma/client";
import { LOCAL_ACTOR, writeAudit } from "@/lib/audit";
import { karachiDateKeyToDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import {
  expensePreviewFromInput,
  matchesExpensePreview,
  type ExpensePreview,
} from "./preview";
import { EXPENSE_CATEGORY_LABELS, expenseSchema } from "./schema";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type CreateExpenseOptions = {
  /** Set only when confirming an assistant proposal. */
  proposalId?: string;
  /** The preview the shopkeeper confirmed; the write must match it. */
  expectedPreview?: ExpensePreview;
};

export type CreateExpenseOutcome = {
  expense: Expense;
  alreadyConfirmed: boolean;
};

/**
 * Record a shop expense.
 *
 * The expense and its audit row are written in one transaction. The date is
 * stored as shop-local midnight so it falls in exactly one report day.
 *
 * `createExpenseWithStatus` also reports whether an assistant proposal was
 * already confirmed, so a replayed confirmation is idempotent. `createExpense`
 * keeps the simple expenses-screen contract.
 */
export async function createExpenseWithStatus(
  input: unknown,
  actor: string = LOCAL_ACTOR,
  options: CreateExpenseOptions = {},
): Promise<Result<CreateExpenseOutcome>> {
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

  if (
    options.expectedPreview &&
    !matchesExpensePreview(data, options.expectedPreview)
  ) {
    return fail(
      "The expense proposal changed. Ask the assistant to prepare it again.",
    );
  }

  const preview = expensePreviewFromInput(data);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // A replayed confirmation returns the expense that already exists.
      if (options.proposalId) {
        const existing = await tx.expense.findUnique({
          where: { proposalId: options.proposalId },
        });

        if (existing) {
          return { expense: existing, alreadyConfirmed: true };
        }
      }

      const created = await tx.expense.create({
        data: {
          category: data.category,
          amountPaisa,
          spentAt,
          note: emptyToNull(data.note),
          proposalId: options.proposalId ?? null,
        },
      });

      await writeAudit(tx, {
        actor,
        action: "EXPENSE_RECORDED",
        entityType: "Expense",
        entityId: created.id,
        summary: `${EXPENSE_CATEGORY_LABELS[data.category]} expense ${formatPaisa(amountPaisa)}`,
        before: null,
        after: {
          category: data.category,
          amountPaisa,
          spentAt: spentAt.toISOString(),
          note: preview.note,
          proposalId: created.proposalId,
        },
        details: {
          source: options.proposalId
            ? "assistant_proposal"
            : "expenses_screen",
          proposalId: options.proposalId ?? null,
        },
      });

      return { expense: created, alreadyConfirmed: false };
    });

    return ok(outcome);
  } catch (error) {
    // A concurrent confirmation may win the unique proposal index.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      options.proposalId
    ) {
      const existing = await prisma.expense.findUnique({
        where: { proposalId: options.proposalId },
      });

      if (existing) {
        return ok({ expense: existing, alreadyConfirmed: true });
      }
    }

    console.error("Expense service error:", error);
    return fail(
      "Something went wrong while saving the expense. Please try again.",
    );
  }
}

/** Record an expense from the expenses screen. */
export async function createExpense(
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Expense>> {
  const result = await createExpenseWithStatus(input, actor);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.expense);
}
