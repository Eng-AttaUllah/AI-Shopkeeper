import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { isoDateKeyInKarachi, karachiDateKeyToDate } from "@/lib/dates";
import { formatDate, formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseSchema,
  type ExpenseCategory,
} from "@/modules/expenses/schema";
import { expensePreviewFromInput } from "@/modules/expenses/preview";

import type { ExpenseProposal } from "./proposal-schema";
import { createExpenseProposalToken } from "./proposal-token";
import type { ProposalToolContext } from "./resolve";

export const PROPOSE_EXPENSE_TOOL_NAME = "propose_expense";
export const PROPOSE_EXPENSE_TOOL_LABEL = "Expense proposal";

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 500 or 500.50");

export const proposeExpenseSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .describe(
      "Expense category: rent, electricity, salaries, transport, or other.",
    ),
  amount: moneyField.describe("Expense amount in rupees."),
  date: z
    .string()
    .trim()
    .max(10)
    .optional()
    .describe("Shop-local date as YYYY-MM-DD. Omit for today."),
  note: z.string().trim().max(200).optional(),
});

export type ProposeExpenseInput = z.infer<typeof proposeExpenseSchema>;

const CATEGORY_ALIASES: Record<string, ExpenseCategory> = {
  rent: "RENT",
  "shop rent": "RENT",
  "building rent": "RENT",
  electricity: "ELECTRICITY",
  electric: "ELECTRICITY",
  "electric bill": "ELECTRICITY",
  "electricity bill": "ELECTRICITY",
  "utility bill": "ELECTRICITY",
  salaries: "SALARIES",
  salary: "SALARIES",
  wages: "SALARIES",
  "staff salary": "SALARIES",
  transport: "TRANSPORT",
  fare: "TRANSPORT",
  fuel: "TRANSPORT",
  petrol: "TRANSPORT",
  other: "OTHER",
  misc: "OTHER",
  miscellaneous: "OTHER",
};

function resolveCategory(value: string): ExpenseCategory | null {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");

  if (
    EXPENSE_CATEGORIES.includes(
      normalized.toUpperCase() as ExpenseCategory,
    )
  ) {
    return normalized.toUpperCase() as ExpenseCategory;
  }

  return CATEGORY_ALIASES[normalized] ?? null;
}

export function expenseProposalToolDefinition(): ToolDefinition {
  const parameters = {
    ...(z.toJSONSchema(proposeExpenseSchema) as Record<string, unknown>),
  };
  delete parameters.$schema;

  return {
    type: "function",
    function: {
      name: PROPOSE_EXPENSE_TOOL_NAME,
      description:
        "Prepare a shop expense for the shopkeeper to confirm. This does not save anything. Use only when the shopkeeper clearly asks to record an expense and has given the category and amount. Omit the date when the expense is for today; use YYYY-MM-DD only for another day. The shopkeeper must press Confirm expense on screen. Never say the expense is recorded.",
      parameters,
    },
  };
}

/** Validate and sign an expense proposal. It never writes. */
export async function runProposeExpenseTool(
  rawArguments: string,
  context: ProposalToolContext,
): Promise<
  Result<{ proposal: ExpenseProposal; model: Record<string, unknown> }>
> {
  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail("The tool arguments were not valid JSON.");
  }

  const parsed = proposeExpenseSchema.safeParse(args);

  if (!parsed.success) {
    return fail(
      `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const category = resolveCategory(parsed.data.category);

  if (!category) {
    return fail(
      `"${parsed.data.category}" is not an expense category. Use rent, electricity, salaries, transport, or other.`,
    );
  }

  const date = parsed.data.date?.trim() || isoDateKeyInKarachi(context.now);

  if (!karachiDateKeyToDate(date)) {
    return fail("Choose a valid expense date in YYYY-MM-DD form.");
  }

  let amountPaisa: number;

  try {
    amountPaisa = rupeesToPaisa(parsed.data.amount);
  } catch {
    return fail("Enter a valid expense amount in rupees.");
  }

  if (amountPaisa <= 0) {
    return fail("Enter an expense amount more than zero.");
  }

  const draft = expenseSchema.safeParse({
    category,
    amount: parsed.data.amount,
    date,
    note: parsed.data.note,
  });

  if (!draft.success) {
    return fail(
      draft.error.issues[0]?.message ?? "Check the expense details and try again.",
    );
  }

  const preview = expensePreviewFromInput(draft.data);
  const proposal = createExpenseProposalToken({
    userId: context.userId,
    draft: draft.data,
    preview,
    now: context.now,
  });
  const spentAt = karachiDateKeyToDate(draft.data.date);

  const summary = [
    "Expense proposal prepared. Nothing has been saved.",
    `Category: ${EXPENSE_CATEGORY_LABELS[draft.data.category]}`,
    `Amount: ${formatPaisa(preview.amountPaisa)}`,
    spentAt ? `Date: ${formatDate(spentAt)}` : `Date: ${draft.data.date}`,
    preview.note ? `Note: ${preview.note}` : "",
    "The shopkeeper must press Confirm expense on screen. Do not say the expense is recorded.",
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
