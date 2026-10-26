import { z } from "zod";

const nameField = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters")
  .max(80, "Use at most 80 characters");

const phoneField = z
  .string()
  .trim()
  .max(20, "Use at most 20 characters")
  .regex(/^[0-9+\-() ]*$/, "Use digits, spaces, +, or -")
  .optional();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .optional();

const moneyField = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 500 or 500.50");

export const customerSchema = z.object({
  name: nameField,
  phone: phoneField,
  note: optionalText(300),
});

export const paymentSchema = z.object({
  customerId: z.string().min(1, "Missing customer"),
  amount: moneyField,
  note: optionalText(200),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
