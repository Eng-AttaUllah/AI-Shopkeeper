import type { ToolDefinition } from "@/lib/ai/types";
import { ok, type Result } from "@/lib/result";

import {
  expenseProposalToolDefinition,
  PROPOSE_EXPENSE_TOOL_LABEL,
  PROPOSE_EXPENSE_TOOL_NAME,
  runProposeExpenseTool,
} from "./expense-proposal";
import {
  paymentProposalToolDefinition,
  PROPOSE_PAYMENT_TOOL_LABEL,
  PROPOSE_PAYMENT_TOOL_NAME,
  runProposePaymentTool,
} from "./payment-proposal";
import type {
  AssistantProposal,
  ExpenseProposal,
  PaymentProposal,
  SaleProposal,
} from "./proposal-schema";
import type { ProposalToolContext } from "./resolve";
import {
  PROPOSAL_TOOL_LABEL,
  PROPOSAL_TOOL_NAME,
  runProposeSaleTool,
  saleProposalToolDefinition,
} from "./sale-proposal";

export type ProposalToolResult =
  | { kind: "sale"; proposal: SaleProposal; model: Record<string, unknown> }
  | {
      kind: "expense";
      proposal: ExpenseProposal;
      model: Record<string, unknown>;
    }
  | {
      kind: "payment";
      proposal: PaymentProposal;
      model: Record<string, unknown>;
    };

export type ProposalTool = {
  name: string;
  label: string;
  definition: ToolDefinition;
  run: (
    rawArguments: string,
    context: ProposalToolContext,
  ) => Promise<Result<ProposalToolResult>>;
};

const PROPOSAL_TOOLS: ProposalTool[] = [
  {
    name: PROPOSAL_TOOL_NAME,
    label: PROPOSAL_TOOL_LABEL,
    definition: saleProposalToolDefinition(),
    run: async (rawArguments, context) => {
      const result = await runProposeSaleTool(rawArguments, context);

      return result.ok ? ok({ kind: "sale", ...result.data }) : result;
    },
  },
  {
    name: PROPOSE_EXPENSE_TOOL_NAME,
    label: PROPOSE_EXPENSE_TOOL_LABEL,
    definition: expenseProposalToolDefinition(),
    run: async (rawArguments, context) => {
      const result = await runProposeExpenseTool(rawArguments, context);

      return result.ok ? ok({ kind: "expense", ...result.data }) : result;
    },
  },
  {
    name: PROPOSE_PAYMENT_TOOL_NAME,
    label: PROPOSE_PAYMENT_TOOL_LABEL,
    definition: paymentProposalToolDefinition(),
    run: async (rawArguments, context) => {
      const result = await runProposePaymentTool(rawArguments, context);

      return result.ok ? ok({ kind: "payment", ...result.data }) : result;
    },
  },
];

export function proposalToolDefinitions(): ToolDefinition[] {
  return PROPOSAL_TOOLS.map((tool) => tool.definition);
}

export function findProposalTool(name: string): ProposalTool | undefined {
  return PROPOSAL_TOOLS.find((tool) => tool.name === name);
}

/** Convert a typed tool result into the union rendered by the chat. */
export function toAssistantProposal(
  result: ProposalToolResult,
): AssistantProposal {
  switch (result.kind) {
    case "sale":
      return { kind: "sale", proposal: result.proposal };
    case "expense":
      return { kind: "expense", proposal: result.proposal };
    case "payment":
      return { kind: "payment", proposal: result.proposal };
  }
}
