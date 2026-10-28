import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  ProviderError,
  type AssistantTurn,
  type ChatMessage,
  type ChatProvider,
  type ChatRequest,
  type ToolCall,
  type ToolDefinition,
} from "./types";

type FetchImpl = typeof fetch;

export type OpenAiCompatibleConfig = {
  /** API root, for example `https://api.openai.com/v1`. */
  baseUrl: string;
  model: string;
  /** Optional: local models such as Ollama do not need a key. */
  apiKey?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
};

type OpenAiToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAiToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

const toolCallSchema = z.object({
  id: z.string().optional(),
  type: z.literal("function").optional(),
  function: z.object({
    name: z.string().min(1),
    arguments: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .transform((value) =>
        typeof value === "string" ? value : JSON.stringify(value),
      ),
  }),
});

const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z.array(toolCallSchema).nullable().optional(),
        }),
      }),
    )
    .min(1),
});

function toOpenAiMessage(message: ChatMessage): OpenAiMessage {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }

  if (message.role === "assistant") {
    const toolCalls = message.toolCalls ?? [];

    return {
      role: "assistant",
      content: message.content,
      ...(toolCalls.length > 0
        ? {
            tool_calls: toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: {
                name: call.name,
                arguments: call.arguments,
              },
            })),
          }
        : {}),
    };
  }

  return { role: message.role, content: message.content };
}

function toOpenAiTools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: tool.function,
  }));
}

/**
 * Build a chat provider for any OpenAI-compatible endpoint.
 *
 * Works with OpenAI, OpenRouter, Groq, LM Studio, Ollama (`/v1`), and similar
 * services. The model must support tool calling for shop questions.
 */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
): ChatProvider {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 45_000;

  return {
    async complete({ messages, tools }: ChatRequest): Promise<AssistantTurn> {
      let response: Response;

      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.apiKey
              ? { Authorization: `Bearer ${config.apiKey}` }
              : {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: messages.map(toOpenAiMessage),
            tools: toOpenAiTools(tools),
            tool_choice: "auto",
            temperature: 0,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        console.error("AI provider request failed:", error);
        throw new ProviderError("The AI provider could not be reached.");
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(
          `AI provider returned ${response.status}: ${body.slice(0, 300)}`,
        );
        throw new ProviderError("The AI provider returned an error.");
      }

      let json: unknown;

      try {
        json = await response.json();
      } catch {
        throw new ProviderError(
          "The AI provider returned an unreadable response.",
        );
      }

      const parsed = responseSchema.safeParse(json);

      if (!parsed.success) {
        console.error(
          "AI provider response did not match the expected shape:",
          parsed.error.issues,
        );
        throw new ProviderError(
          "The AI provider returned an unexpected response.",
        );
      }

      const message = parsed.data.choices[0]?.message;

      if (!message) {
        throw new ProviderError("The AI provider returned an empty response.");
      }

      const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((call) => ({
        id: call.id || randomUUID(),
        name: call.function.name,
        arguments: call.function.arguments,
      }));

      return {
        content: message.content ?? null,
        toolCalls,
      };
    },
  };
}
