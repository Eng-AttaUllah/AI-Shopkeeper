import { z } from "zod";

import { PRODUCT_UNITS } from "@/lib/quantity";

export { fieldErrors } from "@/lib/zod";

const moneyField = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 160 or 160.50");

const quantityField = z
  .string()
  .trim()
  .min(1, "Enter a quantity")
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number, for example 5 or 1.5");

const signedQuantityField = z
  .string()
  .trim()
  .min(1, "Enter a quantity")
  .regex(/^-?\d+(\.\d{1,3})?$/, "Use a number, for example 5 or -1.5");

const nameField = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters")
  .max(80, "Use at most 80 characters");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .optional();

export const productBaseSchema = z.object({
  name: nameField,
  category: optionalText(60),
  unit: z.enum(PRODUCT_UNITS),
  costPrice: moneyField,
  salePrice: moneyField,
  lowStockLevel: quantityField,
  barcode: optionalText(64),
  aliases: optionalText(300),
});

export const createProductSchema = productBaseSchema.extend({
  openingStock: quantityField,
});

export const updateProductSchema = productBaseSchema;

export const STOCK_REASONS = [
  "RESTOCK",
  "DAMAGE",
  "CORRECTION",
  "OTHER",
] as const;

export const adjustStockSchema = z.object({
  productId: z.string().min(1, "Missing product"),
  quantity: signedQuantityField,
  reason: z.enum(STOCK_REASONS),
  note: optionalText(200),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/**
 * Split a comma-separated alias list, deduplicate case-insensitively, and
 * ignore empty entries. Accepts the Pashto comma as well.
 */
export function parseAliases(input: string | undefined): string[] {
  if (!input) {
    return [];
  }

  const seen = new Set<string>();
  const aliases: string[] = [];

  for (const part of input.split(/[,،]/)) {
    const alias = part.trim();

    if (!alias) {
      continue;
    }

    const key = alias.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    aliases.push(alias);

    if (aliases.length === 10) {
      break;
    }
  }

  return aliases;
}
