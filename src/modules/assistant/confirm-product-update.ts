import type { Product } from "@/generated/prisma/client";
import { ok, type Result } from "@/lib/result";
import { updateProductWithStatus } from "@/modules/products/service";

import { verifyProductUpdateProposalToken } from "./proposal-token";

/**
 * Confirm a signed assistant product-edit proposal.
 *
 * The token is verified first (signature, user, expiry), then the product
 * service compares the signed before-state with the current row and writes the
 * update and audit row in one transaction. The audit row's unique proposal id
 * makes a replay idempotent.
 */
export type ConfirmProductUpdateProposalOutcome = {
  product: Product;
  alreadyConfirmed: boolean;
};

export async function confirmProductUpdateProposal(input: {
  token: string;
  userId: string;
  actor: string;
  now?: Date;
}): Promise<Result<ConfirmProductUpdateProposalOutcome>> {
  const verified = verifyProductUpdateProposalToken(
    input.token,
    input.userId,
    input.now,
  );

  if (!verified.ok) {
    return verified;
  }

  const { productId, draft, preview, proposalId } = verified.data;

  const result = await updateProductWithStatus(productId, draft, input.actor, {
    proposalId,
    expectedPreview: preview,
  });

  if (!result.ok) {
    return result;
  }

  return ok(result.data);
}
