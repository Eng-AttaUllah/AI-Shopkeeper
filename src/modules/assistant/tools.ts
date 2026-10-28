import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import { cashBreakdown } from "@/modules/cash/queries";
import {
  customerHistory,
  listCustomersWithBalances,
} from "@/modules/customers/queries";
import { expenseSummaryByCategory } from "@/modules/expenses/queries";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/modules/expenses/schema";
import {
  inventoryValuePaisa,
  listProducts,
  lowStockProducts,
} from "@/modules/products/queries";
import {
  creditOverview,
  periodSummary,
  productSales,
  slowMovingProducts,
} from "@/modules/reports/queries";
import { listSales } from "@/modules/sales/queries";

import { resolveAssistantRange, type ResolvedAssistantRange } from "./range";
import { assistantRangeSchema, type AssistantRangeInput } from "./schema";

export type ToolContext = {
  now: Date;
};

export type ToolRunResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

type AssistantTool = {
  name: string;
  label: string;
  description: string;
  schema: z.ZodTypeAny;
  run: (input: unknown, context: ToolContext) => Promise<unknown>;
};

function defineTool<T>(config: {
  name: string;
  label: string;
  description: string;
  schema: z.ZodType<T>;
  run: (input: T, context: ToolContext) => Promise<unknown>;
}): AssistantTool {
  return {
    name: config.name,
    label: config.label,
    description: config.description,
    schema: config.schema,
    run: (input, context) => config.run(input as T, context),
  };
}

/** A bad range is safe to explain to the model so it can correct itself. */
class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

function resolveRange(
  input: AssistantRangeInput,
  now: Date,
): ResolvedAssistantRange {
  const result = resolveAssistantRange(input, now);

  if (!result.ok) {
    throw new ToolInputError(result.error);
  }

  return result.data;
}

const rangeShape = assistantRangeSchema.shape;

const salesSummaryTool = defineTool({
  name: "sales_summary",
  label: "Sales summary",
  description:
    "Totals for a period: number of sales, revenue, discounts, gross profit, credit given, expenses, and net profit. Use this for questions about how much was sold, revenue, profit, or expenses in a period.",
  schema: z.object({ ...rangeShape }),
  run: async (input, { now }) => {
    const resolved = resolveRange(input, now);
    const summary = await periodSummary(resolved.range);

    return {
      period: resolved.label,
      from: resolved.fromKey,
      to: resolved.toKey,
      salesCount: summary.salesCount,
      revenue: formatPaisa(summary.revenuePaisa),
      discounts: formatPaisa(summary.discountPaisa),
      grossProfit: formatPaisa(summary.profitPaisa),
      creditGiven: formatPaisa(summary.creditGivenPaisa),
      expenses: formatPaisa(summary.expensePaisa),
      netProfit: formatPaisa(summary.netProfitPaisa),
    };
  },
});

const topProductsTool = defineTool({
  name: "top_products",
  label: "Top products",
  description:
    "Best-selling products by revenue for a period. Use this for questions about what sold best. Product revenue is before any sale-level discount.",
  schema: z.object({
    ...rangeShape,
    limit: z.number().int().min(1).max(10).default(5),
  }),
  run: async (input, { now }) => {
    const resolved = resolveRange(input, now);
    const rows = await productSales(resolved.range);

    return {
      period: resolved.label,
      products: rows.slice(0, input.limit).map((row) => ({
        name: row.productName,
        quantity: formatQuantity(row.quantityMilli, row.unit),
        revenue: formatPaisa(row.revenuePaisa),
        profit: formatPaisa(row.profitPaisa),
      })),
      note: "Product revenue is before any sale-level discount.",
    };
  },
});

const productSalesTool = defineTool({
  name: "product_sales",
  label: "Product sales",
  description:
    "Sales and profit for one product, searched by name, alias, or barcode, in a period. Use this for questions about a specific item.",
  schema: z.object({
    ...rangeShape,
    product: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .describe("Product name, alias, or barcode."),
  }),
  run: async (input, { now }) => {
    const resolved = resolveRange(input, now);
    const matches = await listProducts({ search: input.product });

    if (matches.length === 0) {
      return {
        period: resolved.label,
        matchedProducts: [],
        products: [],
        message: `No active product matched "${input.product}".`,
      };
    }

    const ids = new Set(matches.map((product) => product.id));
    const rows = (await productSales(resolved.range)).filter((row) =>
      ids.has(row.productId),
    );

    return {
      period: resolved.label,
      matchedProducts: matches.slice(0, 5).map((product) => product.name),
      products: rows.slice(0, 5).map((row) => ({
        name: row.productName,
        quantity: formatQuantity(row.quantityMilli, row.unit),
        revenue: formatPaisa(row.revenuePaisa),
        profit: formatPaisa(row.profitPaisa),
      })),
      message:
        rows.length === 0
          ? "No sales for the matched product in this period."
          : undefined,
      note: "Product revenue is before any sale-level discount.",
    };
  },
});

const lowStockTool = defineTool({
  name: "low_stock",
  label: "Low stock",
  description:
    "Active products at or below their low-stock level. Use this for questions about what needs restocking.",
  schema: z.object({}),
  run: async () => {
    const products = await lowStockProducts();

    return {
      count: products.length,
      products: products.slice(0, 20).map((product) => ({
        name: product.name,
        stock: formatQuantity(product.stockMilli, product.unit),
        lowStockLevel: formatQuantity(product.lowStockMilli, product.unit),
      })),
      note:
        products.length > 20
          ? "Only the first 20 low-stock products are shown."
          : undefined,
    };
  },
});

const outstandingCreditTool = defineTool({
  name: "outstanding_credit",
  label: "Outstanding credit",
  description:
    "Total khata owed and the customers who owe the most. Use this for questions about who owes money or how much credit is outstanding.",
  schema: z.object({
    limit: z.number().int().min(1).max(20).default(10),
  }),
  run: async (input) => {
    const overview = await creditOverview(input.limit);

    return {
      totalOutstanding: formatPaisa(overview.totalPaisa),
      customerCount: overview.customerCount,
      customers: overview.topCustomers.map((customer) => ({
        name: customer.name,
        phone: customer.phone ?? null,
        balance: formatPaisa(customer.balancePaisa),
      })),
    };
  },
});

const customerBalanceTool = defineTool({
  name: "customer_balance",
  label: "Customer balance",
  description:
    "Find a customer by name or phone and show their khata balance and recent credit sales and payments. Use this for questions about one customer.",
  schema: z.object({
    customer: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .describe("Customer name or phone number."),
    historyLimit: z.number().int().min(0).max(10).default(5),
  }),
  run: async (input) => {
    const matches = await listCustomersWithBalances(input.customer);

    if (matches.length === 0) {
      return {
        matches: 0,
        message: `No customer matched "${input.customer}".`,
      };
    }

    if (matches.length > 1) {
      return {
        matches: matches.length,
        customers: matches.slice(0, 10).map((customer) => ({
          name: customer.name,
          phone: customer.phone ?? null,
          balance: formatPaisa(customer.balancePaisa),
        })),
        message: "More than one customer matched. Ask which one.",
      };
    }

    const [customer] = matches;

    if (!customer) {
      return { matches: 0, message: "No customer matched." };
    }

    const entries =
      input.historyLimit > 0
        ? await customerHistory(customer.id, input.historyLimit)
        : [];

    return {
      matches: 1,
      customer: {
        name: customer.name,
        phone: customer.phone ?? null,
        balance: formatPaisa(customer.balancePaisa),
      },
      recent: entries.map((entry) =>
        entry.kind === "sale"
          ? {
              date: formatDate(entry.createdAt),
              type: "Credit sale",
              number: entry.number,
              total: formatPaisa(entry.totalPaisa),
              paid: formatPaisa(entry.paidPaisa),
              due: formatPaisa(entry.duePaisa),
            }
          : {
              date: formatDate(entry.createdAt),
              type: "Payment",
              amount: formatPaisa(entry.amountPaisa),
              note: entry.note,
            },
      ),
      note:
        customer.balancePaisa < 0
          ? "A negative balance means the customer has paid more than they owe."
          : undefined,
    };
  },
});

const inventoryValueTool = defineTool({
  name: "inventory_value",
  label: "Inventory value",
  description:
    "Total cost value of active stock on hand. Use this for questions about how much stock is worth.",
  schema: z.object({}),
  run: async () => ({
    inventoryCostValue: formatPaisa(await inventoryValuePaisa()),
    note: "This is the cost value of active stock, not the retail selling value.",
  }),
});

const slowMovingTool = defineTool({
  name: "slow_moving",
  label: "Slow-moving stock",
  description:
    "Active products with stock on hand that sold nothing in a period, ordered by the cost value of the stock sitting still. Use this for questions about what is not selling.",
  schema: z.object({
    ...rangeShape,
    limit: z.number().int().min(1).max(20).default(10),
  }),
  run: async (input, { now }) => {
    const resolved = resolveRange(input, now);
    const rows = await slowMovingProducts(resolved.range, input.limit);

    return {
      period: resolved.label,
      products: rows.map((product) => ({
        name: product.name,
        stock: formatQuantity(product.stockMilli, product.unit),
        stockValue: formatPaisa(product.stockValuePaisa),
      })),
      note: `Showing up to ${input.limit} products with the highest stock value.`,
    };
  },
});

const recentSalesTool = defineTool({
  name: "recent_sales",
  label: "Recent sales",
  description:
    "The most recent sales with receipt number, time, total, payment type, customer, and whether the sale was voided.",
  schema: z.object({
    limit: z.number().int().min(1).max(10).default(5),
  }),
  run: async (input) => {
    const sales = await listSales(input.limit);

    return {
      sales: sales.map((sale) => ({
        number: sale.number,
        date: formatDateTime(sale.createdAt),
        total: formatPaisa(sale.totalPaisa),
        payment: sale.paymentMethod === "CREDIT" ? "Credit" : "Cash",
        customer: sale.customer?.name ?? "Walk-in",
        voided: sale.voidedAt
          ? `Voided: ${sale.voidedReason ?? "no reason recorded"}`
          : false,
      })),
    };
  },
});

const expensesSummaryTool = defineTool({
  name: "expenses_summary",
  label: "Expenses",
  description:
    "Expenses for a period, broken down by category, plus the total. Use this for questions about spending or a category such as rent.",
  schema: z.object({ ...rangeShape }),
  run: async (input, { now }) => {
    const resolved = resolveRange(input, now);
    const summary = await expenseSummaryByCategory(resolved.range);

    return {
      period: resolved.label,
      total: formatPaisa(summary.totalPaisa),
      categories: summary.categories.map((row) => ({
        category:
          EXPENSE_CATEGORY_LABELS[row.category as ExpenseCategory] ??
          row.category,
        amount: formatPaisa(row.amountPaisa),
      })),
    };
  },
});

const expectedCashTool = defineTool({
  name: "expected_cash",
  label: "Expected cash",
  description:
    "Expected cash for a period: cash sales, cash paid on credit sales, repayments, expenses, and the expected drawer total. Use this for questions about how much cash should be in the drawer.",
  schema: z.object({ ...rangeShape }),
  run: async (input, { now }) => {
    const resolved = resolveRange(input, now);
    const breakdown = await cashBreakdown(prisma, resolved.range);

    return {
      period: resolved.label,
      cashSales: formatPaisa(breakdown.cashSalesPaisa),
      cashOnCreditSales: formatPaisa(breakdown.creditCashPaisa),
      repayments: formatPaisa(breakdown.repaymentsPaisa),
      expenses: formatPaisa(breakdown.expensesPaisa),
      expectedCash: formatPaisa(breakdown.expectedPaisa),
      note: "Expected cash assumes expenses were paid from the drawer. It is not the counted cash.",
    };
  },
});

const TOOL_LIST = [
  salesSummaryTool,
  topProductsTool,
  productSalesTool,
  lowStockTool,
  outstandingCreditTool,
  customerBalanceTool,
  inventoryValueTool,
  slowMovingTool,
  recentSalesTool,
  expensesSummaryTool,
  expectedCashTool,
];

const TOOL_REGISTRY: Record<string, AssistantTool> = Object.fromEntries(
  TOOL_LIST.map((tool) => [tool.name, tool]),
);

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOL_LIST.map((tool) => [tool.name, tool.label]),
);

/** JSON Schema tool definitions for the model. No tool can write. */
export function assistantToolDefinitions(): ToolDefinition[] {
  return TOOL_LIST.map((tool) => {
    const parameters = {
      ...(z.toJSONSchema(tool.schema) as Record<string, unknown>),
    };
    delete parameters.$schema;

    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters,
      },
    };
  });
}

/** Validate a model-requested tool call before running it. */
export async function runAssistantTool(
  name: string,
  rawArguments: string,
  context: ToolContext,
): Promise<ToolRunResult> {
  const tool = TOOL_REGISTRY[name];

  if (!tool) {
    return {
      ok: false,
      error: `Unknown tool "${name}". Use only the provided tools.`,
    };
  }

  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return { ok: false, error: "The tool arguments were not valid JSON." };
  }

  const parsed = tool.schema.safeParse(args);

  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    };
  }

  try {
    const data = await tool.run(parsed.data, context);

    return { ok: true, data };
  } catch (error) {
    if (error instanceof ToolInputError) {
      return { ok: false, error: error.message };
    }

    console.error(`Assistant tool "${name}" failed:`, error);

    return { ok: false, error: "That data could not be read." };
  }
}
