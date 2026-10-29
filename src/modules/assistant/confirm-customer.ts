import type { Customer } from "@/generated/prisma/client";
import { ok, type Result } from "@/lib/result";
import { createCustomerWithStatus } from "@/modules/customers/service";

import { verifyCustomerProposalToken } from "./proposal-token";

/**
 * Confirm a signed assistant customer-creation proposal.
 *
 * The token is verified first (signature, user, expiry), then the customer
 * service writes the draft and audit row in one transaction. The unique
 * proposal id makes a replay idempotent.
 */
export type ConfirmCustomerProposalOutcome = {
  customer: Customer;
  alreadyConfirmed: boolean;
};

export async function confirmCustomerProposal(input: {
  token: string;
  userId: string;
  actor: string;
  now?: Date;
}): Promise<Result<ConfirmCustomerProposalOutcome>> {
  const verified = verifyCustomerProposalToken(
    input.token,
    input.userId,
    input.now,
  );

  if (!verified.ok) {
    return verified;
  }

  const { draft, preview, proposalId } = verified.data;

  const result = await createCustomerWithStatus(draft, input.actor, {
    proposalId,
    expectedPreview: preview,
  });

  if (!result.ok) {
    return result;
  }

  return ok(result.data);
}
