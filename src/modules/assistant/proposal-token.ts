import type { Result } from "@/lib/result";
import type { PaymentPreview } from "@/modules/customers/preview";
import type { PaymentInput } from "@/modules/customers/schema";
import type { ExpensePreview } from "@/modules/expenses/preview";
import type { ExpenseInput } from "@/modules/expenses/schema";
import type { SalePreview } from "@/modules/sales/pricing";
import type { CreateSaleInput } from "@/modules/sales/schema";

import {
  createProposalMetadata,
  PROPOSAL_TTL_MS,
  signProposalPayload,
  verifyProposalPayload,
} from "./proposal-token-core";
import {
  expenseProposalPayloadSchema,
  paymentProposalPayloadSchema,
  saleProposalPayloadSchema,
  type ExpenseProposal,
  type ExpenseProposalPayload,
  type PaymentProposal,
  type PaymentProposalPayload,
  type SaleProposal,
  type SaleProposalPayload,
} from "./proposal-schema";

/** A proposal is deliberately short-lived; ask again if it expires. */
export const SALE_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const EXPENSE_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const PAYMENT_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;

const SALE_PURPOSE = "assistant-sale-proposal";
const EXPENSE_PURPOSE = "assistant-expense-proposal";
const PAYMENT_PURPOSE = "assistant-payment-proposal";

/** Sign a sale draft and preview for the shopkeeper to confirm. */
export function createSaleProposalToken(input: {
  userId: string;
  draft: CreateSaleInput;
  preview: SalePreview;
  now?: Date;
}): SaleProposal {
  const metadata = createProposalMetadata(input.now);
  const payload: SaleProposalPayload = {
    v: 1,
    kind: "sale",
    ...metadata,
    userId: input.userId,
    draft: input.draft,
    preview: input.preview,
  };

  return {
    token: signProposalPayload(payload, SALE_PURPOSE),
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/** Verify a sale proposal token and return its signed draft and preview. */
export function verifySaleProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<SaleProposalPayload> {
  return verifyProposalPayload(
    token,
    saleProposalPayloadSchema,
    SALE_PURPOSE,
    userId,
    now,
  );
}

/** Sign an expense draft and preview for the shopkeeper to confirm. */
export function createExpenseProposalToken(input: {
  userId: string;
  draft: ExpenseInput;
  preview: ExpensePreview;
  now?: Date;
}): ExpenseProposal {
  const metadata = createProposalMetadata(input.now);
  const payload: ExpenseProposalPayload = {
    v: 1,
    kind: "expense",
    ...metadata,
    userId: input.userId,
    draft: input.draft,
    preview: input.preview,
  };

  return {
    token: signProposalPayload(payload, EXPENSE_PURPOSE),
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/** Verify an expense proposal token and return its signed draft and preview. */
export function verifyExpenseProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<ExpenseProposalPayload> {
  return verifyProposalPayload(
    token,
    expenseProposalPayloadSchema,
    EXPENSE_PURPOSE,
    userId,
    now,
  );
}

/** Sign a repayment draft and preview for the shopkeeper to confirm. */
export function createPaymentProposalToken(input: {
  userId: string;
  draft: PaymentInput;
  preview: PaymentPreview;
  now?: Date;
}): PaymentProposal {
  const metadata = createProposalMetadata(input.now);
  const payload: PaymentProposalPayload = {
    v: 1,
    kind: "payment",
    ...metadata,
    userId: input.userId,
    draft: input.draft,
    preview: input.preview,
  };

  return {
    token: signProposalPayload(payload, PAYMENT_PURPOSE),
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/** Verify a repayment proposal token and return its signed draft and preview. */
export function verifyPaymentProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<PaymentProposalPayload> {
  return verifyProposalPayload(
    token,
    paymentProposalPayloadSchema,
    PAYMENT_PURPOSE,
    userId,
    now,
  );
}
