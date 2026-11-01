import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import { fail, ok, type Result } from "@/lib/result";
import { listCustomersWithBalances } from "@/modules/customers/queries";
import { listProducts } from "@/modules/products/queries";
import {
  priceSale,
  SalePricingError,
  toSalePreview,
  type PricedSale,
} from "@/modules/sales/pricing";
import { createSaleSchema, type CreateSaleInput } from "@/modules/sales/schema";

import type { SaleProposal } from "./proposal-schema";
import { createSaleProposalToken } from "./proposal-token";

/**
 * The one proposal tool. It is deliberately separate from the read-only tool
 * registry: it reads products and customers, prices the sale, and signs a
 * short-lived proposal, but it never writes. The shopkeeper must confirm it in
 * the UI. See `docs/architecture.md`, Phase 7.
 */
export const PROPOSAL_TOOL_NAME = "propose_sale";
export const PROPOSAL_TOOL_LABEL = "Sale proposal";

const quantityField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number, for example 2 or 1.5");

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use rupees, for example 160 or 160.50");

export const proposeSaleSchema = z.object({
  items: z
    .array(
      z.object({
        product: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe("Product name, alias, or barcode."),
        quantity: quantityField,
      }),
    )
    .min(1, "Add at least one item")
    .max(20, "A proposal can have at most 20 lines"),
  discount: moneyField
    .default("0")
    .describe("Sale-level discount in rupees. Use 0 for none."),
  paymentMethod: z
    .enum(["CASH", "CREDIT"])
    .default("CASH")
    .describe("CASH or CREDIT. A credit sale requires a customer."),
  customer: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Customer name or phone. Required for a credit sale."),
  paid: moneyField
    .optional()
    .describe(
      "Cash received in rupees. Omit for a full cash sale or an unpaid credit sale.",
    ),
  note: z.string().trim().max(200).optional(),
});

export type ProposeSaleInput = z.infer<typeof proposeSaleSchema>;

export type ProposalToolContext = {
  userId: string;
  now: Date;
};

type ResolvedProduct = {
  id: string;
  name: string;
  barcode: string | null;
  aliases: string[];
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function matchProducts(
  products: ResolvedProduct[],
  term: string,
): ResolvedProduct[] {
  const normalized = normalize(term);
  const digits = normalizePhone(term);

  const exact = products.filter(
    (product) =>
      normalize(product.name) === normalized ||
      product.aliases.some((alias) => normalize(alias) === normalized) ||
      (product.barcode !== null && product.barcode === term.trim()),
  );

  if (exact.length > 0) {
    return exact;
  }

  if (digits.length >= 3) {
    const byBarcode = products.filter(
      (product) =>
        product.barcode !== null &&
        normalizePhone(product.barcode) === digits,
    );

    if (byBarcode.length > 0) {
      return byBarcode;
    }
  }

  return products.filter(
    (product) =>
      normalize(product.name).includes(normalized) ||
      product.aliases.some((alias) => normalize(alias).includes(normalized)),
  );
}

function productCandidates(matches: ResolvedProduct[]): string {
  return matches
    .slice(0, 5)
    .map((product) => product.name)
    .join(", ");
}

function matchCustomer(
  customers: Array<{
    id: string;
    name: string;
    phone: string | null;
  }>,
  term: string,
) {
  const normalized = normalize(term);
  const digits = normalizePhone(term);

  const exact = customers.filter(
    (customer) =>
      normalize(customer.name) === normalized ||
      (customer.phone !== null &&
        digits.length >= 3 &&
        normalizePhone(customer.phone) === digits),
  );

  if (exact.length > 0) {
    return exact;
  }

  return customers.filter(
    (customer) =>
      normalize(customer.name).includes(normalized) ||
      (customer.phone !== null &&
        digits.length >= 3 &&
        normalizePhone(customer.phone).includes(digits)),
  );
}

async function resolveDraft(
  input: ProposeSaleInput,
): Promise<Result<CreateSaleInput>> {
  const products = (await listProducts()).map((product) => ({
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    aliases: product.aliases.map((alias) => alias.alias),
  }));

  const items: Array<{ productId: string; quantity: string }> = [];

  for (const item of input.items) {
    const matches = matchProducts(products, item.product);

    if (matches.length === 0) {
      return fail(
        `No active product matched "${item.product}". Check the product name with the shopkeeper.`,
      );
    }

    if (matches.length > 1) {
      return fail(
        `More than one product matched "${item.product}": ${productCandidates(matches)}. Ask which one.`,
      );
    }

    const [product] = matches;

    if (!product) {
      return fail(`No active product matched "${item.product}".`);
    }

    items.push({ productId: product.id, quantity: item.quantity });
  }

  let customerId: string | undefined;

  if (input.paymentMethod === "CREDIT") {
    if (!input.customer) {
      return fail(
        "A credit sale needs a customer. Ask who the khata is for, or use a cash sale.",
      );
    }

    // Read every customer and normalize in memory: the stored phone may use
    // spaces or dashes, while the model may send a different format.
    const customers = await listCustomersWithBalances();
    const matches = matchCustomer(customers, input.customer);

    if (matches.length === 0) {
      return fail(
        `No customer matched "${input.customer}". Create the customer on /customers/new first, then ask again.`,
      );
    }

    if (matches.length > 1) {
      return fail(
        `More than one customer matched "${input.customer}": ${matches
          .slice(0, 5)
          .map((customer) => customer.name)
          .join(", ")}. Ask which one.`,
      );
    }

    const [customer] = matches;

    if (!customer) {
      return fail(`No customer matched "${input.customer}".`);
    }

    customerId = customer.id;
  }

  const draft: CreateSaleInput = {
    items,
    discount: input.discount,
    paid: input.paid,
    paymentMethod: input.paymentMethod,
    customerId,
    note: input.note,
  };
  const parsed = createSaleSchema.safeParse(draft);

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Check the sale details and try again.",
    );
  }

  return ok(parsed.data);
}

export function proposalToolDefinitions(): ToolDefinition[] {
  const parameters = {
    ...(z.toJSONSchema(proposeSaleSchema) as Record<string, unknown>),
  };
  delete parameters.$schema;

  return [
    {
      type: "function",
      function: {
        name: PROPOSAL_TOOL_NAME,
        description:
          "Prepare a sale for the shopkeeper to confirm. This does not save anything. Use only when the shopkeeper clearly asks to record a sale and has given the items, quantities, and payment method; for credit, a customer is required. The shopkeeper must press Confirm sale on screen. Never say the sale is recorded.",
        parameters,
      },
    },
  ];
}

/** Validate and run the proposal tool. It reads and signs; it never writes. */
export async function runProposeSaleTool(
  rawArguments: string,
  context: ProposalToolContext,
): Promise<Result<{ proposal: SaleProposal; model: Record<string, unknown> }>> {
  let args: unknown;

  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail("The tool arguments were not valid JSON.");
  }

  const parsed = proposeSaleSchema.safeParse(args);

  if (!parsed.success) {
    return fail(
      `Invalid arguments: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const draft = await resolveDraft(parsed.data);

  if (!draft.ok) {
    return draft;
  }

  let priced: PricedSale;

  try {
    priced = await priceSale(prisma, draft.data);
  } catch (error) {
    if (error instanceof SalePricingError) {
      return fail(error.message, error.fieldErrors);
    }

    console.error("Sale proposal pricing failed:", error);

    return fail("The sale proposal could not be prepared. Check the items.");
  }

  const preview = toSalePreview(priced);
  const proposal = createSaleProposalToken({
    userId: context.userId,
    draft: draft.data,
    preview,
    now: context.now,
  });

  const summary = [
    "Sale proposal prepared. Nothing has been saved.",
    ...preview.lines.map(
      (line) =>
        `${formatQuantity(line.quantityMilli, line.unit)} of ${line.productName} at ${formatPaisa(line.unitPricePaisa)} each = ${formatPaisa(line.lineTotalPaisa)}`,
    ),
    `Subtotal: ${formatPaisa(preview.subtotalPaisa)}`,
    `Discount: ${formatPaisa(preview.discountPaisa)}`,
    `Total: ${formatPaisa(preview.totalPaisa)}`,
    `Payment: ${preview.paymentMethod === "CREDIT" ? "Credit" : "Cash"}`,
    preview.customerName ? `Customer: ${preview.customerName}` : "",
    `Cash received: ${formatPaisa(preview.paidPaisa)}`,
    preview.changePaisa > 0 ? `Change: ${formatPaisa(preview.changePaisa)}` : "",
    "The shopkeeper must press Confirm sale on screen. Do not say the sale is recorded.",
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
