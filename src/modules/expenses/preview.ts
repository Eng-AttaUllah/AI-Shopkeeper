import { z } from "zod";

import { rupeesToPaisa } from "@/lib/money";

import { EXPENSE_CATEGORIES, type ExpenseInput } from "./schema";

/**
 * The shopkeeper-facing expense preview that is signed into a proposal.
 *
 * Expenses have no external price or stock to re-read, so the confirmation
 * compares the signed draft with this preview and relies on the unique
 * proposal id for idempotency. See `docs/architecture.md`, Phase 7.
 */
export const expensePreviewSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amountPaisa: z.number().int().positive(),
  /** Shop-local YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().nullable(),
});

export type ExpensePreview = z.infer<typeof expensePreviewSchema>;

function noteOrNull(note: string | undefined): string | null {
  const trimmed = note?.trim();

  return trimmed ? trimmed : null;
}

/** Build the exact preview shown for a validated expense draft. */
export function expensePreviewFromInput(input: ExpenseInput): ExpensePreview {
  return {
    category: input.category,
    amountPaisa: rupeesToPaisa(input.amount),
    date: input.date,
    note: noteOrNull(input.note),
  };
}

/** True when the draft still produces exactly the preview the owner saw. */
export function matchesExpensePreview(
  input: ExpenseInput,
  preview: ExpensePreview,
): boolean {
  const current = expensePreviewFromInput(input);

  return (
    current.category === preview.category &&
    current.amountPaisa === preview.amountPaisa &&
    current.date === preview.date &&
    current.note === preview.note
  );
}
