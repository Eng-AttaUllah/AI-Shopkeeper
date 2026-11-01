import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { formatPaisa } from "@/lib/format";
import { paisaToRupees } from "@/lib/money";
import {
  PRODUCT_UNITS,
  formatQuantity,
  fromMilli,
  type ProductUnit,
} from "@/lib/quantity";
import { fail, ok, type Result } from "@/lib/result";
import {
  productSnapshotFromInput,
  productSnapshotFromProduct,
  productSnapshotsEqual,
  type ProductSnapshot,
} from "@/modules/products/preview";
import { listProducts } from "@/modules/products/queries";
import {
  updateProductSchema,
  type UpdateProductInput,
} from "@/modules/products/schema";

import type { ProductUpdateProposal } from "./proposal-schema";
import { createProductUpdateProposalToken } from "./proposal-token";
import {
  matchProduct,
  productCandidates,
  type ProductCandidate,
  type ProposalToolContext,
} from "./resolve";

export const PROPOSE_PRODUCT_UPDATE_TOOL_NAME = "propose_product_update";
export const PROPOSE_PRODUCT_UPDATE_TOOL_LABEL = "Product change proposal";

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 160 or 160.50");

const quantityField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number, for example 5 or 1.5");

export const proposeProductUpdateSchema = z.object({
  product: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Existing product name, alias, or barcode."),
  name: z.string().trim().min(2).max(80).optional(),
  category: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(20).optional(),
  costPrice: moneyField.optional(),
  salePrice: moneyField.optional(),
  lowStockLevel: quantityField.optional(),
  barcode: z.string().trim().max(64).optional(),
  aliases: z
    .string()
    .trim()
    .max(300)
    .optional()
    .describe("Replacement comma-separated alternative names."),
});

export type ProposeProductUpdateInput = z.infer<
  typeof proposeProductUpdateSchema
>;

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

function productCandidateList(): Promise<ProductCandidate[]> {
  return listProducts({ includeInactive: true }).then((products) =>
    products.map((product) => ({
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      aliases: product.aliases.map((alias) => alias.alias),
    })),
  );
}

function changeLines(
  before: ProductSnapshot,
  after: ProductSnapshot,
): string[] {
  const lines: string[] = [];

  if (before.name !== after.name) {
    lines.push(`Name: ${before.name} → ${after.name}`);
  }

  if (before.category !== after.category) {
    lines.push(
      `Category: ${before.category ?? "(none)"} → ${after.category ?? "(none)"}`,
    );
  }

  if (before.unit !== after.unit) {
    lines.push(`Unit: ${before.unit} → ${after.unit}`);
  }

  if (before.costPricePaisa !== after.costPricePaisa) {
    lines.push(
      `Cost price: ${formatPaisa(before.costPricePaisa)} → ${formatPaisa(after.costPricePaisa)}`,
    );
  }

  if (before.salePricePaisa !== after.salePricePaisa) {
    lines.push(
      `Sale price: ${formatPaisa(before.salePricePaisa)} → ${formatPaisa(after.salePricePaisa)}`,
    );
  }

  if (before.lowStockMilli !== after.lowStockMilli) {
    lines.push(
      `Low-stock level: ${formatQuantity(before.lowStockMilli, before.unit)} → ${formatQuantity(after.lowStockMilli, after.unit)}`,
    );
  }

  if (before.barcode !== after.barcode) {
    lines.push(
      `Barcode: ${before.barcode ?? "(none)"} → ${after.barcode ?? "(none)"}`,
    );
  }

  if (before.aliases.join("|") !== after.aliases.join("|")) {
    lines.push(
      `Also called: ${before.aliases.join(", ") || "(none)"} → ${after.aliases.join(", ") || "(none)"}`,
    );
  }

  return lines;
}

export function productUpdateProposalToolDefinition(): ToolDefinition {
  const parameters = {
    ...(z.toJSONSchema(proposeProductUpdateSchema) as Record<string, unknown>),
  };
  delete parameters.$schema;

  return {
    type: "function",
    function: {
      name: PROPOSE_PRODUCT_UPDATE_TOOL_NAME,
      description:
        "Prepare an edit to an existing product for the shopkeeper to confirm. This does not save anything. Use only when the shopkeeper clearly asks to change a product's name, category, unit, cost price, sale price, low-stock level, barcode, or alternative names. Omit fields that should stay unchanged. Stock changes use propose_stock_adjustment instead. The shopkeeper must press Confirm changes on screen. Never say the product is updated.",
      parameters,
    },
  };
}

/** Validate and sign a product-edit proposal. It never writes. */
export async function runProposeProductUpdateTool(
  rawArguments: string,
  context: ProposalToolContext,
): Promise<
  Result<{ proposal: ProductUpdateProposal; model: Record<string, unknown> }>
> {
  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail("The tool arguments were not valid JSON.");
  }

  const parsed = proposeProductUpdateSchema.safeParse(args);

  if (!parsed.success) {
    return fail(
      `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const hasChange = [
    parsed.data.name,
    parsed.data.category,
    parsed.data.unit,
    parsed.data.costPrice,
    parsed.data.salePrice,
    parsed.data.lowStockLevel,
    parsed.data.barcode,
    parsed.data.aliases,
  ].some((value) => value !== undefined);

  if (!hasChange) {
    return fail(
      "No product changes were given. Ask what should change, such as the sale price.",
    );
  }

  const products = await productCandidateList();
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

  const product = await listProducts({ includeInactive: true }).then(
    (rows) => rows.find((row) => row.id === candidate.id) ?? null,
  );

  if (!product) {
    return fail("Product not found.");
  }

  const unit = parsed.data.unit
    ? resolveUnit(parsed.data.unit)
    : (product.unit as ProductUnit);

  if (!unit) {
    return fail(
      `"${parsed.data.unit}" is not a product unit. Use kg, litre, piece, or packet.`,
    );
  }

  const merged: UpdateProductInput = {
    name: parsed.data.name ?? product.name,
    category:
      parsed.data.category !== undefined
        ? parsed.data.category
        : (product.category ?? ""),
    unit,
    costPrice:
      parsed.data.costPrice ??
      String(paisaToRupees(product.costPricePaisa)),
    salePrice:
      parsed.data.salePrice ??
      String(paisaToRupees(product.salePricePaisa)),
    lowStockLevel:
      parsed.data.lowStockLevel ?? String(fromMilli(product.lowStockMilli)),
    barcode:
      parsed.data.barcode !== undefined
        ? parsed.data.barcode
        : (product.barcode ?? ""),
    aliases:
      parsed.data.aliases !== undefined
        ? parsed.data.aliases
        : product.aliases.map((alias) => alias.alias).join(", "),
  };

  const draft = updateProductSchema.safeParse(merged);

  if (!draft.success) {
    return fail(
      draft.error.issues[0]?.message ??
        "Check the product changes and try again.",
    );
  }

  const before = productSnapshotFromProduct(product);
  const after = productSnapshotFromInput(draft.data);

  if (productSnapshotsEqual(before, after)) {
    return fail("Those changes would leave the product exactly as it is.");
  }

  const nameNormalized = after.name.trim().replace(/\s+/g, " ").toLowerCase();
  const barcode = after.barcode;

  const duplicate = products.find(
    (other) =>
      other.id !== product.id &&
      (other.name.trim().replace(/\s+/g, " ").toLowerCase() ===
        nameNormalized ||
        (barcode !== null && other.barcode === barcode)),
  );

  if (duplicate) {
    return fail(
      `Another product already uses this name or barcode: ${duplicate.name}. Choose a different one.`,
    );
  }

  const proposal = createProductUpdateProposalToken({
    userId: context.userId,
    productId: product.id,
    draft: draft.data,
    preview: {
      productId: product.id,
      before,
      after,
    },
    now: context.now,
  });

  const changes = changeLines(before, after);
  const summary = [
    "Product change proposal prepared. Nothing has been saved.",
    `Product: ${before.name}`,
    ...changes,
    "The shopkeeper must press Confirm changes on screen. Do not say the product is updated.",
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
