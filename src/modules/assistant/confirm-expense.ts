import type { Expense } from "@/generated/prisma/client";
import { ok, type Result } from "@/lib/result";
import { createExpenseWithStatus } from "@/modules/expenses/service";

import { verifyExpenseProposalToken } from "./proposal-token";

/**
 * Confirm a signed assistant expense proposal.
 *
 * The token is verified first (signature, user, expiry), then the expense
 * service writes the draft and audit row in one transaction. The unique
 * proposal id makes a replay idempotent.
 */
export type ConfirmExpenseProposalOutcome = {
  expense: Expense;
  alreadyConfirmed: boolean;
};

export async function confirmExpenseProposal(input: {
  token: string;
  userId: string;
  actor: string;
  shopId: string;
  now?: Date;
}): Promise<Result<ConfirmExpenseProposalOutcome>> {
  const verified = verifyExpenseProposalToken(
    input.token,
    input.userId,
    input.now,
  );

  if (!verified.ok) {
    return verified;
  }

  const { draft, preview, proposalId } = verified.data;

  const result = await createExpenseWithStatus(
    input.shopId,
    draft,
    input.actor,
    {
      proposalId,
      expectedPreview: preview,
    },
  );

  if (!result.ok) {
    return result;
  }

  return ok(result.data);
}
