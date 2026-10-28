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

import type { SaleProposal } from "./proposal-schema";
import {
  PROPOSAL_TOOL_LABEL,
  PROPOSAL_TOOL_NAME,
  proposalToolDefinitions,
  runProposeSaleTool,
} from "./sale-proposal";
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
  /** A prepared sale that only the shopkeeper can confirm. */
  proposal?: SaleProposal;
};

export type AssistantServiceInput = {
  question: string;
  history?: AssistantHistoryTurn[];
  provider: ChatProvider;
  now?: Date;
  /** The signed-in user id; required before a proposal can be prepared. */
  userId?: string;
};

function systemPrompt(shopName: string, now: Date): string {
  return [
    `You are the AI Shopkeeper Assistant for ${shopName}, a single small shop in Pakistan.`,
    `Today is ${formatDate(now)} in the ${KARACHI_TIME_ZONE} timezone.`,
    "Answer in English. The currency is PKR; money figures returned by tools are already formatted.",
    "Use only the provided tools for shop figures. Never guess, estimate, or invent a number. If a tool returns no data, say so plainly.",
    "If a question is ambiguous, ask one short clarifying question instead of guessing.",
    "You cannot create, edit, void, or delete records directly. You may prepare a sale proposal with propose_sale, but nothing is saved until the shopkeeper presses Confirm sale on screen.",
    "Use propose_sale only when the shopkeeper clearly asks to record a sale and the items, quantities, payment method, and (for credit) customer are known. If anything is missing, ask one short question. Never invent a product, customer, quantity, price, or payment.",
    "After propose_sale returns, tell the shopkeeper to review the card and press Confirm sale. Never say the sale is recorded, saved, or completed. Do not call propose_sale for questions that only ask for information.",
    "If a proposal tool reports an ambiguous or missing product or customer, relay the choices and ask which one.",
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
  const shop = await prisma.shop.findFirst({
    orderBy: { createdAt: "asc" },
    select: { name: true },
  });

  const historyMessages: ChatMessage[] = parsed.data.history.map((turn) =>
    turn.role === "user"
      ? { role: "user", content: turn.content }
      : { role: "assistant", content: turn.content },
  );

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(shop?.name ?? "the shop", now) },
    ...historyMessages,
    { role: "user", content: parsed.data.question },
  ];

  const tools: ToolDefinition[] = [
    ...assistantToolDefinitions(),
    ...proposalToolDefinitions(),
  ];
  const usedTools = new Set<string>();
  let toolCallCount = 0;
  let proposal: SaleProposal | undefined;

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

      if (call.name === PROPOSAL_TOOL_NAME) {
        if (proposal) {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            content: JSON.stringify({
              error:
                "A sale proposal was already prepared. Ask the shopkeeper to confirm or discard it before preparing another.",
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

        const proposalResult = await runProposeSaleTool(call.arguments, {
          userId: input.userId,
          now,
        });

        if (proposalResult.ok) {
          proposal = proposalResult.data.proposal;
          usedTools.add(PROPOSAL_TOOL_LABEL);
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
