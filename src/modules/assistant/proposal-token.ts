import type { Result } from "@/lib/result";
import type {
  CustomerPreview,
  PaymentPreview,
} from "@/modules/customers/preview";
import type { CustomerInput, PaymentInput } from "@/modules/customers/schema";
import type { ExpensePreview } from "@/modules/expenses/preview";
import type { ExpenseInput } from "@/modules/expenses/schema";
import type {
  ProductPreview,
  ProductUpdatePreview,
  StockAdjustmentPreview,
} from "@/modules/products/preview";
import type {
  AdjustStockInput,
  CreateProductInput,
  UpdateProductInput,
} from "@/modules/products/schema";
import type { SalePreview } from "@/modules/sales/pricing";
import type { CreateSaleInput } from "@/modules/sales/schema";

import {
  createProposalMetadata,
  PROPOSAL_TTL_MS,
  signProposalPayload,
  verifyProposalPayload,
} from "./proposal-token-core";
import {
  customerProposalPayloadSchema,
  expenseProposalPayloadSchema,
  paymentProposalPayloadSchema,
  productProposalPayloadSchema,
  productUpdateProposalPayloadSchema,
  saleProposalPayloadSchema,
  stockAdjustmentProposalPayloadSchema,
  type CustomerProposal,
  type CustomerProposalPayload,
  type ExpenseProposal,
  type ExpenseProposalPayload,
  type PaymentProposal,
  type PaymentProposalPayload,
  type ProductProposal,
  type ProductProposalPayload,
  type ProductUpdateProposal,
  type ProductUpdateProposalPayload,
  type SaleProposal,
  type SaleProposalPayload,
  type StockAdjustmentProposal,
  type StockAdjustmentProposalPayload,
} from "./proposal-schema";

/** A proposal is deliberately short-lived; ask again if it expires. */
export const SALE_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const EXPENSE_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const PAYMENT_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const CUSTOMER_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const PRODUCT_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const PRODUCT_UPDATE_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;
export const STOCK_ADJUSTMENT_PROPOSAL_TTL_MS = PROPOSAL_TTL_MS;

const SALE_PURPOSE = "assistant-sale-proposal";
const EXPENSE_PURPOSE = "assistant-expense-proposal";
const PAYMENT_PURPOSE = "assistant-payment-proposal";
const CUSTOMER_PURPOSE = "assistant-customer-proposal";
const PRODUCT_PURPOSE = "assistant-product-proposal";
const PRODUCT_UPDATE_PURPOSE = "assistant-product-update-proposal";
const STOCK_ADJUSTMENT_PURPOSE = "assistant-stock-adjustment-proposal";

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

/** Sign a customer draft and preview for the shopkeeper to confirm. */
export function createCustomerProposalToken(input: {
  userId: string;
  draft: CustomerInput;
  preview: CustomerPreview;
  now?: Date;
}): CustomerProposal {
  const metadata = createProposalMetadata(input.now);
  const payload: CustomerProposalPayload = {
    v: 1,
    kind: "customer",
    ...metadata,
    userId: input.userId,
    draft: input.draft,
    preview: input.preview,
  };

  return {
    token: signProposalPayload(payload, CUSTOMER_PURPOSE),
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/** Verify a customer proposal token and return its signed draft and preview. */
export function verifyCustomerProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<CustomerProposalPayload> {
  return verifyProposalPayload(
    token,
    customerProposalPayloadSchema,
    CUSTOMER_PURPOSE,
    userId,
    now,
  );
}

/** Sign a new-product draft and preview for the shopkeeper to confirm. */
export function createProductProposalToken(input: {
  userId: string;
  draft: CreateProductInput;
  preview: ProductPreview;
  now?: Date;
}): ProductProposal {
  const metadata = createProposalMetadata(input.now);
  const payload: ProductProposalPayload = {
    v: 1,
    kind: "product",
    ...metadata,
    userId: input.userId,
    draft: input.draft,
    preview: input.preview,
  };

  return {
    token: signProposalPayload(payload, PRODUCT_PURPOSE),
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/** Verify a product proposal token and return its signed draft and preview. */
export function verifyProductProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<ProductProposalPayload> {
  return verifyProposalPayload(
    token,
    productProposalPayloadSchema,
    PRODUCT_PURPOSE,
    userId,
    now,
  );
}

/** Sign a product-edit draft and preview for the shopkeeper to confirm. */
export function createProductUpdateProposalToken(input: {
  userId: string;
  productId: string;
  draft: UpdateProductInput;
  preview: ProductUpdatePreview;
  now?: Date;
}): ProductUpdateProposal {
  const metadata = createProposalMetadata(input.now);
  const payload: ProductUpdateProposalPayload = {
    v: 1,
    kind: "product_update",
    ...metadata,
    userId: input.userId,
    productId: input.productId,
    draft: input.draft,
    preview: input.preview,
  };

  return {
    token: signProposalPayload(payload, PRODUCT_UPDATE_PURPOSE),
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/** Verify a product-edit token and return its signed draft and preview. */
export function verifyProductUpdateProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<ProductUpdateProposalPayload> {
  return verifyProposalPayload(
    token,
    productUpdateProposalPayloadSchema,
    PRODUCT_UPDATE_PURPOSE,
    userId,
    now,
  );
}

/** Sign a stock-adjustment draft and preview for the shopkeeper to confirm. */
export function createStockAdjustmentProposalToken(input: {
  userId: string;
  draft: AdjustStockInput;
  preview: StockAdjustmentPreview;
  now?: Date;
}): StockAdjustmentProposal {
  const metadata = createProposalMetadata(input.now);
  const payload: StockAdjustmentProposalPayload = {
    v: 1,
    kind: "stock_adjustment",
    ...metadata,
    userId: input.userId,
    draft: input.draft,
    preview: input.preview,
  };

  return {
    token: signProposalPayload(payload, STOCK_ADJUSTMENT_PURPOSE),
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/** Verify a stock-adjustment token and return its signed draft and preview. */
export function verifyStockAdjustmentProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<StockAdjustmentProposalPayload> {
  return verifyProposalPayload(
    token,
    stockAdjustmentProposalPayloadSchema,
    STOCK_ADJUSTMENT_PURPOSE,
    userId,
    now,
  );
}
