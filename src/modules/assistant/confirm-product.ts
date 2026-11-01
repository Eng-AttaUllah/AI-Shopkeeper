import type { Product } from "@/generated/prisma/client";
import { ok, type Result } from "@/lib/result";
import { createProductWithStatus } from "@/modules/products/service";

import { verifyProductProposalToken } from "./proposal-token";

/**
 * Confirm a signed assistant product-creation proposal.
 *
 * The token is verified first (signature, user, expiry), then the product
 * service writes the product, its opening stock movement, and its audit row in
 * one transaction. The unique proposal id makes a replay idempotent.
 */
export type ConfirmProductProposalOutcome = {
  product: Product;
  alreadyConfirmed: boolean;
};

export async function confirmProductProposal(input: {
  token: string;
  userId: string;
  actor: string;
  now?: Date;
}): Promise<Result<ConfirmProductProposalOutcome>> {
  const verified = verifyProductProposalToken(
    input.token,
    input.userId,
    input.now,
  );

  if (!verified.ok) {
    return verified;
  }

  const { draft, preview, proposalId } = verified.data;

  const result = await createProductWithStatus(draft, input.actor, {
    proposalId,
    expectedPreview: preview,
  });

  if (!result.ok) {
    return result;
  }

  return ok(result.data);
}
