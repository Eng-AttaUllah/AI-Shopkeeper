import type { Payment } from "@/generated/prisma/client";
import { ok, type Result } from "@/lib/result";
import { recordPaymentWithStatus } from "@/modules/customers/service";

import { verifyPaymentProposalToken } from "./proposal-token";

/**
 * Confirm a signed assistant repayment proposal.
 *
 * The token is verified first (signature, user, expiry), then the payment
 * service re-reads the khata balance inside the write transaction and refuses
 * to write if it changed. The unique proposal id makes a replay idempotent.
 */
export type ConfirmPaymentProposalOutcome = {
  payment: Payment;
  customerName: string;
  alreadyConfirmed: boolean;
};

export async function confirmPaymentProposal(input: {
  token: string;
  userId: string;
  actor: string;
  now?: Date;
}): Promise<Result<ConfirmPaymentProposalOutcome>> {
  const verified = verifyPaymentProposalToken(
    input.token,
    input.userId,
    input.now,
  );

  if (!verified.ok) {
    return verified;
  }

  const { draft, preview, proposalId } = verified.data;

  const result = await recordPaymentWithStatus(draft, input.actor, {
    proposalId,
    expectedPreview: preview,
  });

  if (!result.ok) {
    return result;
  }

  return ok(result.data);
}
