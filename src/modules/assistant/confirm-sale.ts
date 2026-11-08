import { ok, type Result } from "@/lib/result";
import type { SaleWithItems } from "@/modules/sales/queries";
import { createSaleWithStatus } from "@/modules/sales/service";

import { verifySaleProposalToken } from "./proposal-token";

/**
 * Confirm a signed assistant sale proposal.
 *
 * The token is verified first (signature, user, expiry), then the existing sale
 * service re-prices the draft and writes it in one transaction. The service
 * refuses the write if prices or stock no longer produce the preview the
 * shopkeeper confirmed, and the unique proposal id makes a replay idempotent.
 */
export type ConfirmSaleProposalOutcome = {
  sale: SaleWithItems;
  alreadyConfirmed: boolean;
};

export async function confirmSaleProposal(input: {
  token: string;
  userId: string;
  actor: string;
  shopId: string;
  now?: Date;
}): Promise<Result<ConfirmSaleProposalOutcome>> {
  const verified = verifySaleProposalToken(
    input.token,
    input.userId,
    input.now,
  );

  if (!verified.ok) {
    return verified;
  }

  const { draft, preview, proposalId } = verified.data;

  const result = await createSaleWithStatus(
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
