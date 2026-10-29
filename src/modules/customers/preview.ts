import { z } from "zod";

import { rupeesToPaisa } from "@/lib/money";

import type { CustomerInput, PaymentInput } from "./schema";

/**
 * The shopkeeper-facing customer preview that is signed into a proposal.
 *
 * A customer has no derived state, so confirmation only needs to compare the
 * draft with this preview. The unique proposal id on the customer row makes a
 * replay idempotent. See `docs/architecture.md`, Phase 7.
 */
export const customerPreviewSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable(),
  note: z.string().nullable(),
});

export type CustomerPreview = z.infer<typeof customerPreviewSchema>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

/** Build the exact preview shown for a validated customer draft. */
export function customerPreviewFromInput(input: CustomerInput): CustomerPreview {
  return {
    name: input.name,
    phone: emptyToNull(input.phone),
    note: emptyToNull(input.note),
  };
}

/** True when the draft still produces exactly the preview the owner saw. */
export function matchesCustomerPreview(
  input: CustomerInput,
  preview: CustomerPreview,
): boolean {
  const current = customerPreviewFromInput(input);

  return (
    current.name === preview.name &&
    current.phone === preview.phone &&
    current.note === preview.note
  );
}

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
    note: emptyToNull(input.note),
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
    emptyToNull(input.note) === preview.note &&
    balanceBeforePaisa === preview.balanceBeforePaisa &&
    balanceBeforePaisa - amountPaisa === preview.balanceAfterPaisa
  );
}
