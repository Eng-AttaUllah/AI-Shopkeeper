import { z } from "zod";

/** The expense categories the shop uses. Stored as the uppercase key. */
export const EXPENSE_CATEGORIES = [
  "RENT",
  "ELECTRICITY",
  "SALARIES",
  "TRANSPORT",
  "OTHER",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  SALARIES: "Salaries",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

const moneyField = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 500 or 500.50");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .optional();

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: moneyField,
  /** Shop-local YYYY-MM-DD. Converted to local midnight by the service. */
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
  note: optionalText(200),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
