import { z } from "zod";

import { rupeesToPaisa } from "@/lib/money";

import type { PaymentInput } from "./schema";

/**
 * The shopkeeper-facing repayment preview that is signed into a proposal.
 *
 * A khata balance is derived from other rows, so confirmation re-reads it
 * inside the write transaction and refuses a payment if it changed. The
 * customer name is display-only; a rename does not invalidate the proposal.
 * See `docs/architecture.md`, Phase 7.
 */
export const paymentPreviewSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  amountPaisa: z.number().int().positive(),
  note: z.string().nullable(),
  balanceBeforePaisa: z.number().int().nonnegative(),
  balanceAfterPaisa: z.number().int().nonnegative(),
});

export type PaymentPreview = z.infer<typeof paymentPreviewSchema>;

function noteOrNull(note: string | undefined): string | null {
  const trimmed = note?.trim();

  return trimmed ? trimmed : null;
}

/** Build the exact preview shown for a validated repayment draft. */
export function paymentPreviewFromInput(
  input: PaymentInput,
  customerName: string,
  balanceBeforePaisa: number,
): PaymentPreview {
  const amountPaisa = rupeesToPaisa(input.amount);

  return {
    customerId: input.customerId,
    customerName,
    amountPaisa,
    note: noteOrNull(input.note),
    balanceBeforePaisa,
    balanceAfterPaisa: balanceBeforePaisa - amountPaisa,
  };
}

/**
 * True when the draft and the current khata balance still produce exactly the
 * preview the owner saw. The customer name is intentionally not compared.
 */
export function matchesPaymentPreview(
  input: PaymentInput,
  balanceBeforePaisa: number,
  preview: PaymentPreview,
): boolean {
  const amountPaisa = rupeesToPaisa(input.amount);

  return (
    input.customerId === preview.customerId &&
    amountPaisa === preview.amountPaisa &&
    noteOrNull(input.note) === preview.note &&
    balanceBeforePaisa === preview.balanceBeforePaisa &&
    balanceBeforePaisa - amountPaisa === preview.balanceAfterPaisa
  );
}
