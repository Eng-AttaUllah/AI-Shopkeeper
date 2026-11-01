import { z } from "zod";

import {
  customerPreviewSchema,
  paymentPreviewSchema,
  type CustomerPreview,
  type PaymentPreview,
} from "@/modules/customers/preview";
import { customerSchema, paymentSchema } from "@/modules/customers/schema";
import {
  expensePreviewSchema,
  type ExpensePreview,
} from "@/modules/expenses/preview";
import { expenseSchema } from "@/modules/expenses/schema";
import {
  productPreviewSchema,
  productUpdatePreviewSchema,
  stockAdjustmentPreviewSchema,
  type ProductPreview,
  type ProductUpdatePreview,
  type StockAdjustmentPreview,
} from "@/modules/products/preview";
import {
  adjustStockSchema,
  createProductSchema,
  updateProductSchema,
} from "@/modules/products/schema";
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

/** The signed payload behind an assistant expense proposal. */
export const expenseProposalPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal("expense"),
  proposalId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  draft: expenseSchema,
  preview: expensePreviewSchema,
});

export type ExpenseProposalPayload = z.infer<
  typeof expenseProposalPayloadSchema
>;

/** The object the browser receives for an expense proposal. */
export type ExpenseProposal = {
  token: string;
  proposalId: string;
  expiresAt: string;
  preview: ExpensePreview;
};

/** The signed payload behind an assistant repayment proposal. */
export const paymentProposalPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal("payment"),
  proposalId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  draft: paymentSchema,
  preview: paymentPreviewSchema,
});

export type PaymentProposalPayload = z.infer<
  typeof paymentProposalPayloadSchema
>;

/** The object the browser receives for a repayment proposal. */
export type PaymentProposal = {
  token: string;
  proposalId: string;
  expiresAt: string;
  preview: PaymentPreview;
};

/** The signed payload behind an assistant customer-creation proposal. */
export const customerProposalPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal("customer"),
  proposalId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  draft: customerSchema,
  preview: customerPreviewSchema,
});

export type CustomerProposalPayload = z.infer<
  typeof customerProposalPayloadSchema
>;

/** The object the browser receives for a customer proposal. */
export type CustomerProposal = {
  token: string;
  proposalId: string;
  expiresAt: string;
  preview: CustomerPreview;
};

/** The signed payload behind an assistant product-creation proposal. */
export const productProposalPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal("product"),
  proposalId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  draft: createProductSchema,
  preview: productPreviewSchema,
});

export type ProductProposalPayload = z.infer<
  typeof productProposalPayloadSchema
>;

/** The object the browser receives for a product-creation proposal. */
export type ProductProposal = {
  token: string;
  proposalId: string;
  expiresAt: string;
  preview: ProductPreview;
};

/** The signed payload behind an assistant product-edit proposal. */
export const productUpdateProposalPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal("product_update"),
  proposalId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  productId: z.string().min(1),
  draft: updateProductSchema,
  preview: productUpdatePreviewSchema,
});

export type ProductUpdateProposalPayload = z.infer<
  typeof productUpdateProposalPayloadSchema
>;

/** The object the browser receives for a product-edit proposal. */
export type ProductUpdateProposal = {
  token: string;
  proposalId: string;
  expiresAt: string;
  preview: ProductUpdatePreview;
};

/** The signed payload behind an assistant stock-adjustment proposal. */
export const stockAdjustmentProposalPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal("stock_adjustment"),
  proposalId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  draft: adjustStockSchema,
  preview: stockAdjustmentPreviewSchema,
});

export type StockAdjustmentProposalPayload = z.infer<
  typeof stockAdjustmentProposalPayloadSchema
>;

/** The object the browser receives for a stock-adjustment proposal. */
export type StockAdjustmentProposal = {
  token: string;
  proposalId: string;
  expiresAt: string;
  preview: StockAdjustmentPreview;
};

/** Any proposal an assistant answer can carry. Only one is shown per answer. */
export type AssistantProposal =
  | { kind: "sale"; proposal: SaleProposal }
  | { kind: "expense"; proposal: ExpenseProposal }
  | { kind: "payment"; proposal: PaymentProposal }
  | { kind: "customer"; proposal: CustomerProposal }
  | { kind: "product"; proposal: ProductProposal }
  | { kind: "product_update"; proposal: ProductUpdateProposal }
  | { kind: "stock_adjustment"; proposal: StockAdjustmentProposal };
