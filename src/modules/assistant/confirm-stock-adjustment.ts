import type { Product, StockMovement } from "@/generated/prisma/client";
import { ok, type Result } from "@/lib/result";
import { adjustStockWithStatus } from "@/modules/products/service";

import { verifyStockAdjustmentProposalToken } from "./proposal-token";

/**
 * Confirm a signed assistant stock-adjustment proposal.
 *
 * The token is verified first (signature, user, expiry), then the stock service
 * re-reads the current stock and refuses the write if it changed. The movement
 * and audit row are written in one transaction, and the unique proposal id
 * makes a replay idempotent.
 */
export type ConfirmStockAdjustmentProposalOutcome = {
  product: Product;
  movement: StockMovement;
  alreadyConfirmed: boolean;
};

export async function confirmStockAdjustmentProposal(input: {
  token: string;
  userId: string;
  actor: string;
  shopId: string;
  now?: Date;
}): Promise<Result<ConfirmStockAdjustmentProposalOutcome>> {
  const verified = verifyStockAdjustmentProposalToken(
    input.token,
    input.userId,
    input.now,
  );

  if (!verified.ok) {
    return verified;
  }

  const { draft, preview, proposalId } = verified.data;

  const result = await adjustStockWithStatus(
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
