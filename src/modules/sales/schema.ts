import { z } from "zod";

const quantityField = z
  .string()
  .trim()
  .min(1, "Enter a quantity")
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number, for example 2 or 1.5");

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 160 or 160.50");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .optional();

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, "Missing product"),
  quantity: quantityField,
});

/**
 * A sale as submitted by the sell screen. Prices are never accepted from the
 * client: the service reads them from the product rows inside the transaction.
 */
export const createSaleSchema = z.object({
  items: z
    .array(saleItemInputSchema)
    .min(1, "Add at least one item")
    .max(50, "A sale can have at most 50 lines"),
  discount: moneyField.default("0"),
  paid: moneyField.optional(),
  paymentMethod: z.enum(["CASH", "CREDIT"]),
  /// Required for credit sales; ignored for cash.
  customerId: z.string().min(1).optional(),
  note: optionalText(200),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const voidSaleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Say why this sale is being voided")
    .max(200, "Use at most 200 characters"),
});

export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
