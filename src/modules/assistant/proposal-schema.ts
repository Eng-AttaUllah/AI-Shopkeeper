import { z } from "zod";

import { salePreviewSchema, type SalePreview } from "@/modules/sales/pricing";
import { createSaleSchema } from "@/modules/sales/schema";

/**
 * The signed payload behind an assistant sale proposal.
 *
 * It contains the exact draft and the priced preview the shopkeeper saw. The
 * confirmation action verifies the signature and refuses to write if current
 * prices or stock no longer produce the same preview. See
 * `docs/architecture.md`, Phase 7.
 */
export const saleProposalPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal("sale"),
  proposalId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  draft: createSaleSchema,
  preview: salePreviewSchema,
});

export type SaleProposalPayload = z.infer<typeof saleProposalPayloadSchema>;

/** The object the browser receives. The token is opaque and signed. */
export type SaleProposal = {
  token: string;
  proposalId: string;
  expiresAt: string;
  preview: SalePreview;
};
