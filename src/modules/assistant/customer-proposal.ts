import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { fail, ok, type Result } from "@/lib/result";
import { listCustomersWithBalances } from "@/modules/customers/queries";
import { customerSchema } from "@/modules/customers/schema";
import { customerPreviewFromInput } from "@/modules/customers/preview";

import type { CustomerProposal } from "./proposal-schema";
import { createCustomerProposalToken } from "./proposal-token";
import {
  normalize,
  normalizePhone,
  type ProposalToolContext,
} from "./resolve";

export const PROPOSE_CUSTOMER_TOOL_NAME = "propose_customer";
export const PROPOSE_CUSTOMER_TOOL_LABEL = "Customer proposal";

export const proposeCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .describe("Customer name as the shopkeeper said it."),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .describe("Phone number, if given."),
  note: z.string().trim().max(300).optional(),
});

export type ProposeCustomerInput = z.infer<typeof proposeCustomerSchema>;

export function customerProposalToolDefinition(): ToolDefinition {
  const parameters = {
    ...(z.toJSONSchema(proposeCustomerSchema) as Record<string, unknown>),
  };
  delete parameters.$schema;

  return {
    type: "function",
    function: {
      name: PROPOSE_CUSTOMER_TOOL_NAME,
      description:
        "Prepare a new customer for the shopkeeper to confirm. This does not save anything. Use only when the shopkeeper clearly asks to add a customer and has given a name. Do not use when a customer with the same name or phone already exists; use the existing customer instead. The shopkeeper must press Confirm customer on screen. Never say the customer is created.",
      parameters,
    },
  };
}

/** Validate and sign a customer-creation proposal. It never writes. */
export async function runProposeCustomerTool(
  rawArguments: string,
  context: ProposalToolContext,
): Promise<
  Result<{ proposal: CustomerProposal; model: Record<string, unknown> }>
> {
  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail("The tool arguments were not valid JSON.");
  }

  const parsed = proposeCustomerSchema.safeParse(args);

  if (!parsed.success) {
    return fail(
      `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const draft = customerSchema.safeParse({
    name: parsed.data.name,
    phone: parsed.data.phone,
    note: parsed.data.note,
  });

  if (!draft.success) {
    return fail(
      draft.error.issues[0]?.message ??
        "Check the customer details and try again.",
    );
  }

  const customers = await listCustomersWithBalances(context.shopId ?? "");
  const phoneDigits = normalizePhone(draft.data.phone ?? "");

  const duplicate = customers.find(
    (customer) =>
      normalize(customer.name) === normalize(draft.data.name) ||
      (phoneDigits.length >= 3 &&
        customer.phone !== null &&
        normalizePhone(customer.phone) === phoneDigits),
  );

  if (duplicate) {
    return fail(
      `A customer with this name or phone already exists: ${duplicate.name}. Use the existing customer instead of creating a duplicate.`,
    );
  }

  const preview = customerPreviewFromInput(draft.data);
  const proposal = createCustomerProposalToken({
    userId: context.userId,
    draft: draft.data,
    preview,
    now: context.now,
  });

  const summary = [
    "Customer proposal prepared. Nothing has been saved.",
    `Name: ${preview.name}`,
    preview.phone ? `Phone: ${preview.phone}` : "",
    preview.note ? `Note: ${preview.note}` : "",
    "The shopkeeper must press Confirm customer on screen. Do not say the customer is created.",
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
