import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { formatPaisa } from "@/lib/format";
import { PRODUCT_UNITS, formatQuantity, type ProductUnit } from "@/lib/quantity";
import { fail, ok, type Result } from "@/lib/result";
import { productPreviewFromInput } from "@/modules/products/preview";
import { listProducts } from "@/modules/products/queries";
import { createProductSchema } from "@/modules/products/schema";

import type { ProductProposal } from "./proposal-schema";
import { createProductProposalToken } from "./proposal-token";
import { normalize, type ProposalToolContext } from "./resolve";

export const PROPOSE_PRODUCT_TOOL_NAME = "propose_product";
export const PROPOSE_PRODUCT_TOOL_LABEL = "Product proposal";

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 160 or 160.50");

const quantityField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number, for example 5 or 1.5");

export const proposeProductSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().max(60).optional(),
  unit: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .describe("kg, litre, piece, or packet."),
  costPrice: moneyField.describe("Cost price in rupees."),
  salePrice: moneyField.describe("Sale price in rupees."),
  openingStock: quantityField
    .default("0")
    .describe("Opening stock. Use 0 when unknown."),
  lowStockLevel: quantityField
    .default("0")
    .describe("Low-stock alert level. Use 0 for no alert."),
  barcode: z.string().trim().max(64).optional(),
  aliases: z
    .string()
    .trim()
    .max(300)
    .optional()
    .describe("Comma-separated alternative names."),
});

export type ProposeProductInput = z.infer<typeof proposeProductSchema>;

const UNIT_ALIASES: Record<string, ProductUnit> = {
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  litre: "litre",
  liter: "litre",
  litres: "litre",
  liters: "litre",
  l: "litre",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  unit: "piece",
  units: "piece",
  item: "piece",
  items: "piece",
  packet: "packet",
  packets: "packet",
  pack: "packet",
  packs: "packet",
  pkt: "packet",
};

function resolveUnit(value: string): ProductUnit | null {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (PRODUCT_UNITS.includes(normalized as ProductUnit)) {
    return normalized as ProductUnit;
  }

  return UNIT_ALIASES[normalized] ?? null;
}

export function productProposalToolDefinition(): ToolDefinition {
  const parameters = {
    ...(z.toJSONSchema(proposeProductSchema) as Record<string, unknown>),
  };
  delete parameters.$schema;

  return {
    type: "function",
    function: {
      name: PROPOSE_PRODUCT_TOOL_NAME,
      description:
        "Prepare a new product for the shopkeeper to confirm. This does not save anything. Use only when the shopkeeper clearly asks to add a product and has given its name, unit, cost price, and sale price. Opening stock defaults to 0. Do not use when a product with the same name or barcode already exists. The shopkeeper must press Confirm product on screen. Never say the product is created.",
      parameters,
    },
  };
}

/** Validate and sign a product-creation proposal. It never writes. */
export async function runProposeProductTool(
  rawArguments: string,
  context: ProposalToolContext,
): Promise<
  Result<{ proposal: ProductProposal; model: Record<string, unknown> }>
> {
  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail("The tool arguments were not valid JSON.");
  }

  const parsed = proposeProductSchema.safeParse(args);

  if (!parsed.success) {
    return fail(
      `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const unit = resolveUnit(parsed.data.unit);

  if (!unit) {
    return fail(
      `"${parsed.data.unit}" is not a product unit. Use kg, litre, piece, or packet.`,
    );
  }

  const draft = createProductSchema.safeParse({
    ...parsed.data,
    unit,
  });

  if (!draft.success) {
    return fail(
      draft.error.issues[0]?.message ??
        "Check the product details and try again.",
    );
  }

  const products = await listProducts({ includeInactive: true });
  const nameNormalized = normalize(draft.data.name);
  const barcode = draft.data.barcode?.trim() || null;

  const duplicate = products.find(
    (product) =>
      normalize(product.name) === nameNormalized ||
      (barcode !== null && product.barcode === barcode),
  );

  if (duplicate) {
    return fail(
      `A product with this name or barcode already exists: ${duplicate.name}. Use the existing product instead of creating a duplicate.`,
    );
  }

  const preview = productPreviewFromInput(draft.data);
  const proposal = createProductProposalToken({
    userId: context.userId,
    draft: draft.data,
    preview,
    now: context.now,
  });

  const summary = [
    "Product proposal prepared. Nothing has been saved.",
    `Name: ${preview.name}`,
    preview.category ? `Category: ${preview.category}` : "",
    `Unit: ${preview.unit}`,
    `Cost price: ${formatPaisa(preview.costPricePaisa)}`,
    `Sale price: ${formatPaisa(preview.salePricePaisa)}`,
    `Opening stock: ${formatQuantity(preview.openingStockMilli, preview.unit)}`,
    `Low-stock level: ${formatQuantity(preview.lowStockMilli, preview.unit)}`,
    preview.barcode ? `Barcode: ${preview.barcode}` : "",
    preview.aliases.length > 0
      ? `Also called: ${preview.aliases.join(", ")}`
      : "",
    "The shopkeeper must press Confirm product on screen. Do not say the product is created.",
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
