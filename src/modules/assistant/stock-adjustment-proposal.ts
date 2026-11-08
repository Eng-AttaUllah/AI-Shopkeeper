import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { formatQuantity } from "@/lib/quantity";
import { fail, ok, type Result } from "@/lib/result";
import {
  stockAdjustmentPreviewFromInput,
} from "@/modules/products/preview";
import { listProducts } from "@/modules/products/queries";
import {
  STOCK_REASONS,
  adjustStockSchema,
  type StockReason,
} from "@/modules/products/schema";

import type { StockAdjustmentProposal } from "./proposal-schema";
import { createStockAdjustmentProposalToken } from "./proposal-token";
import {
  matchProduct,
  productCandidates,
  type ProductCandidate,
  type ProposalToolContext,
} from "./resolve";

export const PROPOSE_STOCK_ADJUSTMENT_TOOL_NAME = "propose_stock_adjustment";
export const PROPOSE_STOCK_ADJUSTMENT_TOOL_LABEL = "Stock adjustment proposal";

const signedQuantityField = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,3})?$/, "Use a number, for example 10 or -2.5");

export const proposeStockAdjustmentSchema = z.object({
  product: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Product name, alias, or barcode."),
  quantity: signedQuantityField.describe(
    "Signed quantity. Positive adds stock, negative removes it.",
  ),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .describe("restock, damage, correction, or other."),
  note: z.string().trim().max(200).optional(),
});

export type ProposeStockAdjustmentInput = z.infer<
  typeof proposeStockAdjustmentSchema
>;

const REASON_ALIASES: Record<string, StockReason> = {
  restock: "RESTOCK",
  "stock in": "RESTOCK",
  receive: "RESTOCK",
  received: "RESTOCK",
  purchase: "RESTOCK",
  "new stock": "RESTOCK",
  damage: "DAMAGE",
  damaged: "DAMAGE",
  broken: "DAMAGE",
  expired: "DAMAGE",
  loss: "DAMAGE",
  lost: "DAMAGE",
  correction: "CORRECTION",
  correct: "CORRECTION",
  count: "CORRECTION",
  recount: "CORRECTION",
  other: "OTHER",
  misc: "OTHER",
  miscellaneous: "OTHER",
};

function resolveReason(value: string): StockReason | null {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");

  if (STOCK_REASONS.includes(normalized.toUpperCase() as StockReason)) {
    return normalized.toUpperCase() as StockReason;
  }

  return REASON_ALIASES[normalized] ?? null;
}

function productCandidateList(shopId: string): Promise<ProductCandidate[]> {
  return listProducts(shopId, { includeInactive: true }).then((products) =>
    products.map((product) => ({
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      aliases: product.aliases.map((alias) => alias.alias),
    })),
  );
}

export function stockAdjustmentProposalToolDefinition(): ToolDefinition {
  const parameters = {
    ...(z.toJSONSchema(proposeStockAdjustmentSchema) as Record<string, unknown>),
  };
  delete parameters.$schema;

  return {
    type: "function",
    function: {
      name: PROPOSE_STOCK_ADJUSTMENT_TOOL_NAME,
      description:
        "Prepare a stock adjustment for the shopkeeper to confirm. This does not save anything. Use only when the shopkeeper clearly asks to add or remove stock and gives the product, signed quantity, and reason. Positive quantity adds stock; negative removes it. Stock cannot go below zero. Sales and voids change stock automatically; do not use this for them. The shopkeeper must press Confirm adjustment on screen. Never say the stock is adjusted.",
      parameters,
    },
  };
}

/** Validate and sign a stock-adjustment proposal. It never writes. */
export async function runProposeStockAdjustmentTool(
  rawArguments: string,
  context: ProposalToolContext,
): Promise<
  Result<{
    proposal: StockAdjustmentProposal;
    model: Record<string, unknown>;
  }>
> {
  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail("The tool arguments were not valid JSON.");
  }

  const parsed = proposeStockAdjustmentSchema.safeParse(args);

  if (!parsed.success) {
    return fail(
      `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const reason = resolveReason(parsed.data.reason);

  if (!reason) {
    return fail(
      `"${parsed.data.reason}" is not a stock reason. Use restock, damage, correction, or other.`,
    );
  }

  const products = await productCandidateList(context.shopId ?? "");
  const matches = matchProduct(products, parsed.data.product);

  if (matches.length === 0) {
    return fail(
      `No product matched "${parsed.data.product}". Check the product name with the shopkeeper.`,
    );
  }

  if (matches.length > 1) {
    return fail(
      `More than one product matched "${parsed.data.product}": ${productCandidates(matches)}. Ask which one.`,
    );
  }

  const [candidate] = matches;

  if (!candidate) {
    return fail(`No product matched "${parsed.data.product}".`);
  }

  const product = await listProducts(context.shopId ?? "", {
    includeInactive: true,
  }).then(
    (rows) => rows.find((row) => row.id === candidate.id) ?? null,
  );

  if (!product) {
    return fail("Product not found.");
  }

  const draft = adjustStockSchema.safeParse({
    productId: product.id,
    quantity: parsed.data.quantity,
    reason,
    note: parsed.data.note,
  });

  if (!draft.success) {
    return fail(
      draft.error.issues[0]?.message ??
        "Check the stock adjustment and try again.",
    );
  }

  const preview = stockAdjustmentPreviewFromInput(draft.data, product);

  if (preview.deltaMilli === 0) {
    return fail("Enter a quantity other than zero.");
  }

  if (preview.afterMilli < 0) {
    return fail(
      `Only ${formatQuantity(product.stockMilli, product.unit)} in stock, so this adjustment would take it below zero.`,
    );
  }

  const proposal = createStockAdjustmentProposalToken({
    userId: context.userId,
    draft: draft.data,
    preview,
    now: context.now,
  });

  const summary = [
    "Stock adjustment proposal prepared. Nothing has been saved.",
    `Product: ${preview.productName}`,
    `Stock before: ${formatQuantity(preview.beforeMilli, preview.unit)}`,
    `Change: ${preview.deltaMilli > 0 ? "+" : ""}${formatQuantity(preview.deltaMilli, preview.unit)}`,
    `Stock after: ${formatQuantity(preview.afterMilli, preview.unit)}`,
    `Reason: ${preview.reason.toLowerCase()}`,
    preview.note ? `Note: ${preview.note}` : "",
    "The shopkeeper must press Confirm adjustment on screen. Do not say the stock is adjusted.",
  ]
    .filter(Boolean)
    .join("\n");

  return ok({
    proposal,
    model: {
      proposalId: proposal.proposalId,
      expiresAt: proposal.expiresAt,
      summary,
    },
  });
}
