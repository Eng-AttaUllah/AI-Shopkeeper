import type { ToolDefinition } from "@/lib/ai/types";
import { ok, type Result } from "@/lib/result";

import {
  customerProposalToolDefinition,
  PROPOSE_CUSTOMER_TOOL_LABEL,
  PROPOSE_CUSTOMER_TOOL_NAME,
  runProposeCustomerTool,
} from "./customer-proposal";
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
  CustomerProposal,
  ExpenseProposal,
  PaymentProposal,
  ProductProposal,
  ProductUpdateProposal,
  SaleProposal,
  StockAdjustmentProposal,
} from "./proposal-schema";
import {
  productProposalToolDefinition,
  PROPOSE_PRODUCT_TOOL_LABEL,
  PROPOSE_PRODUCT_TOOL_NAME,
  runProposeProductTool,
} from "./product-proposal";
import {
  productUpdateProposalToolDefinition,
  PROPOSE_PRODUCT_UPDATE_TOOL_LABEL,
  PROPOSE_PRODUCT_UPDATE_TOOL_NAME,
  runProposeProductUpdateTool,
} from "./product-update-proposal";
import type { ProposalToolContext } from "./resolve";
import {
  PROPOSAL_TOOL_LABEL,
  PROPOSAL_TOOL_NAME,
  runProposeSaleTool,
  saleProposalToolDefinition,
} from "./sale-proposal";
import {
  stockAdjustmentProposalToolDefinition,
  PROPOSE_STOCK_ADJUSTMENT_TOOL_LABEL,
  PROPOSE_STOCK_ADJUSTMENT_TOOL_NAME,
  runProposeStockAdjustmentTool,
} from "./stock-adjustment-proposal";

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
    }
  | {
      kind: "customer";
      proposal: CustomerProposal;
      model: Record<string, unknown>;
    }
  | {
      kind: "product";
      proposal: ProductProposal;
      model: Record<string, unknown>;
    }
  | {
      kind: "product_update";
      proposal: ProductUpdateProposal;
      model: Record<string, unknown>;
    }
  | {
      kind: "stock_adjustment";
      proposal: StockAdjustmentProposal;
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
  {
    name: PROPOSE_CUSTOMER_TOOL_NAME,
    label: PROPOSE_CUSTOMER_TOOL_LABEL,
    definition: customerProposalToolDefinition(),
    run: async (rawArguments, context) => {
      const result = await runProposeCustomerTool(rawArguments, context);

      return result.ok ? ok({ kind: "customer", ...result.data }) : result;
    },
  },
  {
    name: PROPOSE_PRODUCT_TOOL_NAME,
    label: PROPOSE_PRODUCT_TOOL_LABEL,
    definition: productProposalToolDefinition(),
    run: async (rawArguments, context) => {
      const result = await runProposeProductTool(rawArguments, context);

      return result.ok ? ok({ kind: "product", ...result.data }) : result;
    },
  },
  {
    name: PROPOSE_PRODUCT_UPDATE_TOOL_NAME,
    label: PROPOSE_PRODUCT_UPDATE_TOOL_LABEL,
    definition: productUpdateProposalToolDefinition(),
    run: async (rawArguments, context) => {
      const result = await runProposeProductUpdateTool(rawArguments, context);

      return result.ok ? ok({ kind: "product_update", ...result.data }) : result;
    },
  },
  {
    name: PROPOSE_STOCK_ADJUSTMENT_TOOL_NAME,
    label: PROPOSE_STOCK_ADJUSTMENT_TOOL_LABEL,
    definition: stockAdjustmentProposalToolDefinition(),
    run: async (rawArguments, context) => {
      const result = await runProposeStockAdjustmentTool(
        rawArguments,
        context,
      );

      return result.ok
        ? ok({ kind: "stock_adjustment", ...result.data })
        : result;
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
    case "customer":
      return { kind: "customer", proposal: result.proposal };
    case "product":
      return { kind: "product", proposal: result.proposal };
    case "product_update":
      return { kind: "product_update", proposal: result.proposal };
    case "stock_adjustment":
      return { kind: "stock_adjustment", proposal: result.proposal };
  }
}
