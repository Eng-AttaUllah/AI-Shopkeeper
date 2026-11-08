import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { outstandingPaisa } from "@/modules/customers/balance";
import { paymentPreviewFromInput } from "@/modules/customers/preview";
import { listCustomersWithBalances } from "@/modules/customers/queries";
import { paymentSchema } from "@/modules/customers/schema";

import type { PaymentProposal } from "./proposal-schema";
import { createPaymentProposalToken } from "./proposal-token";
import { matchCustomer, type ProposalToolContext } from "./resolve";

export const PROPOSE_PAYMENT_TOOL_NAME = "propose_payment";
export const PROPOSE_PAYMENT_TOOL_LABEL = "Payment proposal";

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 500 or 500.50");

export const proposePaymentSchema = z.object({
  customer: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Customer name or phone."),
  amount: moneyField.describe("Repayment amount in rupees."),
  note: z.string().trim().max(200).optional(),
});

export type ProposePaymentInput = z.infer<typeof proposePaymentSchema>;

export function paymentProposalToolDefinition(): ToolDefinition {
  const parameters = {
    ...(z.toJSONSchema(proposePaymentSchema) as Record<string, unknown>),
  };
  delete parameters.$schema;

  return {
    type: "function",
    function: {
      name: PROPOSE_PAYMENT_TOOL_NAME,
      description:
        "Prepare a khata repayment for the shopkeeper to confirm. This does not save anything. Use only when the shopkeeper clearly asks to record a repayment and has given the customer and amount. The customer must already exist, and the amount cannot exceed the outstanding balance. The shopkeeper must press Confirm payment on screen. Never say the payment is recorded.",
      parameters,
    },
  };
}

/** Validate and sign a repayment proposal. It never writes. */
export async function runProposePaymentTool(
  rawArguments: string,
  context: ProposalToolContext,
): Promise<
  Result<{ proposal: PaymentProposal; model: Record<string, unknown> }>
> {
  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail("The tool arguments were not valid JSON.");
  }

  const parsed = proposePaymentSchema.safeParse(args);

  if (!parsed.success) {
    return fail(
      `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const customers = await listCustomersWithBalances(context.shopId ?? "");
  const matches = matchCustomer(customers, parsed.data.customer);

  if (matches.length === 0) {
    return fail(
      `No customer matched "${parsed.data.customer}". Create the customer on /customers/new first, then ask again.`,
    );
  }

  if (matches.length > 1) {
    return fail(
      `More than one customer matched "${parsed.data.customer}": ${matches
        .slice(0, 5)
        .map((customer) => customer.name)
        .join(", ")}. Ask which one.`,
    );
  }

  const customer = matches[0];

  if (!customer) {
    return fail(`No customer matched "${parsed.data.customer}".`);
  }

  let amountPaisa: number;

  try {
    amountPaisa = rupeesToPaisa(parsed.data.amount);
  } catch {
    return fail("Enter a valid repayment amount in rupees.");
  }

  if (amountPaisa <= 0) {
    return fail("Enter a repayment amount more than zero.");
  }

  const outstanding = await outstandingPaisa(
    prisma,
    context.shopId ?? "",
    customer.id,
  );

  if (outstanding <= 0) {
    return fail("This customer has no outstanding balance.");
  }

  if (amountPaisa > outstanding) {
    return fail(`Only ${formatPaisa(outstanding)} is outstanding.`);
  }

  const draft = paymentSchema.safeParse({
    customerId: customer.id,
    amount: parsed.data.amount,
    note: parsed.data.note,
  });

  if (!draft.success) {
    return fail(
      draft.error.issues[0]?.message ??
        "Check the repayment details and try again.",
    );
  }

  const preview = paymentPreviewFromInput(
    draft.data,
    customer.name,
    outstanding,
  );
  const proposal = createPaymentProposalToken({
    userId: context.userId,
    draft: draft.data,
    preview,
    now: context.now,
  });

  const summary = [
    "Payment proposal prepared. Nothing has been saved.",
    `Customer: ${preview.customerName}`,
    `Amount: ${formatPaisa(preview.amountPaisa)}`,
    `Khata before: ${formatPaisa(preview.balanceBeforePaisa)}`,
    `Khata after: ${formatPaisa(preview.balanceAfterPaisa)}`,
    preview.note ? `Note: ${preview.note}` : "",
    "The shopkeeper must press Confirm payment on screen. Do not say the payment is recorded.",
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
