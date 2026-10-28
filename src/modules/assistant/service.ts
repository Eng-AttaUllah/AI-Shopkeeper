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
  /** Human-readable names of the read-only checks used, for the UI. */
  tools: string[];
};

export type AssistantServiceInput = {
  question: string;
  history?: AssistantHistoryTurn[];
  provider: ChatProvider;
  now?: Date;
};

function systemPrompt(shopName: string, now: Date): string {
  return [
    `You are the AI Shopkeeper Assistant for ${shopName}, a single small shop in Pakistan.`,
    `Today is ${formatDate(now)} in the ${KARACHI_TIME_ZONE} timezone.`,
    "Answer in English. The currency is PKR; money figures returned by tools are already formatted.",
    "Use only the provided tools for shop figures. Never guess, estimate, or invent a number. If a tool returns no data, say so plainly.",
    "If a question is ambiguous, ask one short clarifying question instead of guessing.",
    "You are read-only. You cannot create, edit, void, or delete records. If asked to change something, say the assistant is read-only and point to the relevant screen.",
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

  const tools: ToolDefinition[] = assistantToolDefinitions();
  const usedTools = new Set<string>();
  let toolCallCount = 0;

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

      return ok({ answer, tools: [...usedTools] });
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
