import { z } from "zod";

const moneyField = z
  .string()
  .trim()
  .min(1, "Enter the counted cash")
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 500 or 500.50");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .optional();

export const cashReconciliationSchema = z.object({
  /** Shop-local YYYY-MM-DD. */
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
  counted: moneyField,
  note: optionalText(200),
});

export type CashReconciliationInput = z.infer<
  typeof cashReconciliationSchema
>;
