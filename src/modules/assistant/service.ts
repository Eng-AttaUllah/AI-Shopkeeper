import type {
  AssistantTurn,
  ChatMessage,
  ChatProvider,
  ToolDefinition,
} from "@/lib/ai/types";
import { KARACHI_TIME_ZONE } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { fail, ok, type Result } from "@/lib/result";
import type { Locale } from "@/lib/i18n";

import type { AssistantProposal } from "./proposal-schema";
import {
  findProposalTool,
  proposalToolDefinitions,
  toAssistantProposal,
} from "./proposal-tools";
import {
  assistantRequestSchema,
  type AssistantHistoryTurn,
} from "./schema";
import {
  assistantToolDefinitions,
  runAssistantTool,
  TOOL_LABELS,
} from "./tools";

/** Keep one question cheap and predictable: at most 4 model turns. */
const MAX_ROUNDS = 4;
const MAX_TOOL_CALLS = 8;

export type AssistantAnswer = {
  answer: string;
  /** Human-readable names of the checks used, for the UI. */
  tools: string[];
  /** A prepared record that only the shopkeeper can confirm. */
  proposal?: AssistantProposal;
};

export type AssistantServiceInput = {
  question: string;
  history?: AssistantHistoryTurn[];
  provider: ChatProvider;
  now?: Date;
  /** The signed-in user id; required before a proposal can be prepared. */
  userId?: string;
  /** The shop every read and proposal is scoped to (Invariant 13). */
  shopId: string;
  /** The shopkeeper's chosen locale; the model answers in this language. */
  locale?: Locale;
};

function systemPrompt(
  shopName: string,
  now: Date,
  locale: Locale,
): string {
  return [
    `You are the EasyShop Assistant for ${shopName}, a single small shop in Pakistan.`,
    `Today is ${formatDate(now)} in the ${KARACHI_TIME_ZONE} timezone.`,
    locale === "ps"
      ? "Answer in Pashto."
      : "Answer in English. The currency is PKR; money figures returned by tools are already formatted.",
    "Use only the provided tools for shop figures. Never guess, estimate, or invent a number. If a tool returns no data, say so plainly.",
    "If a question is ambiguous, ask one short clarifying question instead of guessing.",
    "You cannot create, edit, void, or delete records directly. You may prepare a proposal with propose_sale, propose_expense, propose_payment, propose_customer, propose_product, propose_product_update, or propose_stock_adjustment, but nothing is saved until the shopkeeper presses the matching Confirm button on screen.",
    "Use propose_sale only when the shopkeeper clearly asks to record a sale and the items, quantities, payment method, and (for credit) customer are known. If anything is missing, ask one short question. Never invent a product, customer, quantity, price, or payment.",
    "Use propose_expense only when the shopkeeper clearly asks to record an expense and the category and amount are known. Omit the date when it is for today; use YYYY-MM-DD only for another day.",
    "Use propose_payment only when the shopkeeper clearly asks to record a repayment and the customer and amount are known. The customer must already exist, and the amount cannot exceed the outstanding khata balance.",
    "Use propose_customer only when the shopkeeper clearly asks to add a new customer and the name is known. Never create a duplicate when a customer with the same name or phone already exists.",
    "Use propose_product only when the shopkeeper clearly asks to add a new product and gives its name, unit, cost price, and sale price. Opening stock defaults to 0.",
    "Use propose_product_update only when the shopkeeper clearly asks to change an existing product's name, category, unit, cost price, sale price, low-stock level, barcode, or alternative names. Omit fields that stay unchanged. Use propose_stock_adjustment for stock, never a product edit.",
    "Use propose_stock_adjustment only when the shopkeeper clearly asks to add or remove stock and gives the product, signed quantity, and reason. Sales and voids change stock automatically; never use it for those.",
    "After any proposal tool returns, tell the shopkeeper to review the card and press the matching Confirm button: Confirm sale, Confirm expense, Confirm payment, Confirm customer, Confirm product, Confirm changes, or Confirm adjustment. Never say it is recorded, saved, or completed. Do not call a proposal tool for questions that only ask for information.",
    "If a proposal tool reports an ambiguous or missing product, customer, category, or unit, relay the choices and ask which one.",
    "Use the smallest set of tools needed. Answer in plain text, at most six short lines or a short bullet list. Quote the formatted figures exactly.",
    "Do not mention tool names, JSON, or internal details.",
  ].join("\n");
}

/**
 * Answer one shop question through the read-only tool registry.
 *
 * The provider is injected so tests can run without a network call. Every tool
 * result comes from the database; the model is never given SQL access.
 */
export async function answerShopQuestion(
  input: AssistantServiceInput,
): Promise<Result<AssistantAnswer>> {
  const parsed = assistantRequestSchema.safeParse({
    question: input.question,
    history: input.history ?? [],
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Enter a question.");
  }

  const now = input.now ?? new Date();
  const shop = input.shopId
    ? await prisma.shop.findUnique({
        where: { id: input.shopId },
        select: { name: true },
      })
    : await prisma.shop.findFirst({
        orderBy: { createdAt: "asc" },
        select: { name: true },
      });

  const historyMessages: ChatMessage[] = parsed.data.history.map((turn) =>
    turn.role === "user"
      ? { role: "user", content: turn.content }
      : { role: "assistant", content: turn.content },
  );

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(shop?.name ?? "the shop", now, input.locale ?? "en") },
    ...historyMessages,
    { role: "user", content: parsed.data.question },
  ];

  const tools: ToolDefinition[] = [
    ...assistantToolDefinitions(),
    ...proposalToolDefinitions(),
  ];
  const usedTools = new Set<string>();
  let toolCallCount = 0;
  let proposal: AssistantProposal | undefined;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let turn: AssistantTurn;

    try {
      turn = await input.provider.complete({ messages, tools });
    } catch (error) {
      console.error("Assistant provider failed:", error);

      return fail(
        "The assistant could not reach the AI provider. Check the connection and settings.",
      );
    }

    if (turn.toolCalls.length === 0) {
      const answer = turn.content?.trim();

      if (!answer) {
        return fail(
          "The assistant did not return an answer. Try rephrasing the question.",
        );
      }

      return ok({ answer, tools: [...usedTools], proposal });
    }

    messages.push({
      role: "assistant",
      content: turn.content,
      toolCalls: turn.toolCalls,
    });

    for (const call of turn.toolCalls) {
      toolCallCount += 1;

      if (toolCallCount > MAX_TOOL_CALLS) {
        return fail(
          "The assistant needed too many steps. Try a simpler question.",
        );
      }

      const proposalTool = findProposalTool(call.name);

      if (proposalTool) {
        if (proposal) {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            content: JSON.stringify({
              error:
                "A proposal was already prepared. Ask the shopkeeper to confirm or discard it before preparing another.",
            }),
          });
          continue;
        }

        if (!input.userId) {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            content: JSON.stringify({
              error:
                "The assistant cannot prepare a proposal for this sign-in.",
            }),
          });
          continue;
        }

        const proposalResult = await proposalTool.run(call.arguments, {
          userId: input.userId,
          shopId: input.shopId,
          now,
        });

        if (proposalResult.ok) {
          proposal = toAssistantProposal(proposalResult.data);
          usedTools.add(proposalTool.label);
          messages.push({
            role: "tool",
            toolCallId: call.id,
            content: JSON.stringify(proposalResult.data.model),
          });
        } else {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            content: JSON.stringify({ error: proposalResult.error }),
          });
        }

        continue;
      }

      const result = await runAssistantTool(call.name, call.arguments, {
        now,
        shopId: input.shopId,
      });

      const label = TOOL_LABELS[call.name];

      if (label) {
        usedTools.add(label);
      }

      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify(
          result.ok ? result.data : { error: result.error },
        ),
      });
    }
  }

  return fail("The assistant used too many steps. Try a simpler question.");
}
