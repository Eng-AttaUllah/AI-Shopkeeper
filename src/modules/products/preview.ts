import { z } from "zod";

import type { Product, ProductAlias } from "@/generated/prisma/client";
import { rupeesToPaisa } from "@/lib/money";
import { PRODUCT_UNITS, toMilli } from "@/lib/quantity";

import {
  parseAliases,
  STOCK_REASONS,
  type AdjustStockInput,
  type CreateProductInput,
  type UpdateProductInput,
} from "./schema";

/** A product's display and price fields at one point in time. */
export const productSnapshotSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable(),
  unit: z.enum(PRODUCT_UNITS),
  costPricePaisa: z.number().int().nonnegative(),
  salePricePaisa: z.number().int().nonnegative(),
  lowStockMilli: z.number().int().nonnegative(),
  barcode: z.string().nullable(),
  aliases: z.array(z.string()),
});

export type ProductSnapshot = z.infer<typeof productSnapshotSchema>;

/**
 * The preview for creating a product. Opening stock is part of the signed
 * draft, so the owner sees the exact quantity that will be recorded.
 */
export const productPreviewSchema = productSnapshotSchema.extend({
  openingStockMilli: z.number().int().nonnegative(),
});

export type ProductPreview = z.infer<typeof productPreviewSchema>;

/**
 * The preview for editing a product. Both sides are signed: the confirmation
 * refuses to write if the product changed after the proposal was prepared.
 */
export const productUpdatePreviewSchema = z.object({
  productId: z.string().min(1),
  before: productSnapshotSchema,
  after: productSnapshotSchema,
});

export type ProductUpdatePreview = z.infer<typeof productUpdatePreviewSchema>;

/**
 * The preview for a stock adjustment. `beforeMilli` is re-read inside the
 * write transaction so a stale proposal cannot apply a different change.
 */
export const stockAdjustmentPreviewSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  unit: z.string().min(1),
  beforeMilli: z.number().int().nonnegative(),
  deltaMilli: z.number().int(),
  afterMilli: z.number().int().nonnegative(),
  reason: z.enum(STOCK_REASONS),
  note: z.string().nullable(),
});

export type StockAdjustmentPreview = z.infer<
  typeof stockAdjustmentPreviewSchema
>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function snapshotFromInput(input: UpdateProductInput): ProductSnapshot {
  return {
    name: input.name,
    category: emptyToNull(input.category),
    unit: input.unit,
    costPricePaisa: rupeesToPaisa(input.costPrice),
    salePricePaisa: rupeesToPaisa(input.salePrice),
    lowStockMilli: toMilli(input.lowStockLevel),
    barcode: emptyToNull(input.barcode),
    aliases: parseAliases(input.aliases),
  };
}

/** Build the exact snapshot shown for a validated product draft. */
export function productSnapshotFromInput(
  input: UpdateProductInput,
): ProductSnapshot {
  return snapshotFromInput(input);
}

/** Build the exact preview shown for a validated create-product draft. */
export function productPreviewFromInput(
  input: CreateProductInput,
): ProductPreview {
  return {
    ...snapshotFromInput(input),
    openingStockMilli: toMilli(input.openingStock),
  };
}

/** Snapshot the current product, including aliases, for a stale check. */
export function productSnapshotFromProduct(
  product: Product & { aliases: ProductAlias[] },
): ProductSnapshot {
  return {
    name: product.name,
    category: product.category,
    unit: product.unit as (typeof PRODUCT_UNITS)[number],
    costPricePaisa: product.costPricePaisa,
    salePricePaisa: product.salePricePaisa,
    lowStockMilli: product.lowStockMilli,
    barcode: product.barcode,
    aliases: product.aliases
      .map((alias) => alias.alias)
      .sort((left, right) => left.localeCompare(right)),
  };
}

function sameAliases(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort((a, b) => a.localeCompare(b));
  const sortedRight = [...right].sort((a, b) => a.localeCompare(b));

  return sortedLeft.every((alias, index) => alias === sortedRight[index]);
}

/** Compare two product snapshots, ignoring alias order. */
export function productSnapshotsEqual(
  left: ProductSnapshot,
  right: ProductSnapshot,
): boolean {
  return (
    left.name === right.name &&
    left.category === right.category &&
    left.unit === right.unit &&
    left.costPricePaisa === right.costPricePaisa &&
    left.salePricePaisa === right.salePricePaisa &&
    left.lowStockMilli === right.lowStockMilli &&
    left.barcode === right.barcode &&
    sameAliases(left.aliases, right.aliases)
  );
}

/** True when a create-product draft still matches the signed preview. */
export function matchesProductPreview(
  input: CreateProductInput,
  preview: ProductPreview,
): boolean {
  const current = productPreviewFromInput(input);

  return (
    productSnapshotsEqual(current, preview) &&
    current.openingStockMilli === preview.openingStockMilli
  );
}

/** True when an update draft still matches the signed after-state. */
export function matchesProductUpdatePreview(
  input: UpdateProductInput,
  preview: ProductUpdatePreview,
): boolean {
  return productSnapshotsEqual(
    productSnapshotFromInput(input),
    preview.after,
  );
}

/** Build the exact stock-adjustment preview shown to the owner. */
export function stockAdjustmentPreviewFromInput(
  input: AdjustStockInput,
  product: Pick<Product, "name" | "unit" | "stockMilli">,
): StockAdjustmentPreview {
  const deltaMilli = toMilli(input.quantity);

  return {
    productId: input.productId,
    productName: product.name,
    unit: product.unit,
    beforeMilli: product.stockMilli,
    deltaMilli,
    afterMilli: product.stockMilli + deltaMilli,
    reason: input.reason,
    note: emptyToNull(input.note),
  };
}

/** True when the draft and current stock still match the signed preview. */
export function matchesStockAdjustmentPreview(
  input: AdjustStockInput,
  currentStockMilli: number,
  preview: StockAdjustmentPreview,
): boolean {
  const deltaMilli = toMilli(input.quantity);

  return (
    input.productId === preview.productId &&
    deltaMilli === preview.deltaMilli &&
    currentStockMilli === preview.beforeMilli &&
    currentStockMilli + deltaMilli === preview.afterMilli &&
    input.reason === preview.reason &&
    emptyToNull(input.note) === preview.note
  );
}
