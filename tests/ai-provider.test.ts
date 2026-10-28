import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenAiCompatibleProvider } from "@/lib/ai/openai-compatible";
import { ProviderError, type ToolDefinition } from "@/lib/ai/types";

const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "sales_summary",
      description: "Totals for a period.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAI-compatible provider", () => {
  it("sends a chat-completions request and parses tool calls", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;

      return jsonResponse({
        choices: [
          {
            message: {
              content: "I will check.",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "sales_summary",
                    arguments: JSON.stringify({ range: "today" }),
                  },
                },
              ],
            },
          },
        ],
      });
    };

    const provider = createOpenAiCompatibleProvider({
      baseUrl: "https://example.test/v1/",
      model: "test-model",
      apiKey: "test-key",
      fetchImpl,
      timeoutMs: 1000,
    });

    const turn = await provider.complete({
      messages: [{ role: "user", content: "How much did I sell today?" }],
      tools,
    });

    expect(capturedUrl).toBe("https://example.test/v1/chat/completions");

    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer test-key");

    const body = JSON.parse(String(capturedInit?.body)) as {
      model: string;
      messages: unknown[];
      tools: unknown[];
      temperature: number;
      tool_choice: string;
    };

    expect(body.model).toBe("test-model");
    expect(body.messages).toHaveLength(1);
    expect(body.tools).toHaveLength(1);
    expect(body.temperature).toBe(0);
    expect(body.tool_choice).toBe("auto");

    expect(turn.content).toBe("I will check.");
    expect(turn.toolCalls).toEqual([
      {
        id: "call-1",
        name: "sales_summary",
        arguments: JSON.stringify({ range: "today" }),
      },
    ]);
  });

  it("omits the Authorization header when no key is set", async () => {
    let capturedInit: RequestInit | undefined;

    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;

      return jsonResponse({
        choices: [{ message: { content: "Hello", tool_calls: null } }],
      });
    };

    const provider = createOpenAiCompatibleProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "llama3.1",
      fetchImpl,
      timeoutMs: 1000,
    });

    const turn = await provider.complete({
      messages: [{ role: "user", content: "Hello" }],
      tools,
    });

    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(turn).toEqual({ content: "Hello", toolCalls: [] });
  });

  it("accepts object arguments and fills in a missing tool-call id", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  function: {
                    name: "sales_summary",
                    arguments: { range: "today" },
                  },
                },
              ],
            },
          },
        ],
      });

    const provider = createOpenAiCompatibleProvider({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetchImpl,
      timeoutMs: 1000,
    });

    const turn = await provider.complete({
      messages: [{ role: "user", content: "Today?" }],
      tools,
    });

    expect(turn.toolCalls).toHaveLength(1);
    expect(turn.toolCalls[0]?.id).toBeTruthy();
    expect(turn.toolCalls[0]?.arguments).toBe(
      JSON.stringify({ range: "today" }),
    );
  });

  it("throws a safe ProviderError on an error response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchImpl: typeof fetch = async () =>
      new Response("bad request", { status: 400 });

    const provider = createOpenAiCompatibleProvider({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetchImpl,
      timeoutMs: 1000,
    });

    await expect(
      provider.complete({
        messages: [{ role: "user", content: "Hello" }],
        tools,
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws a safe ProviderError on a malformed response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ choices: [] });

    const provider = createOpenAiCompatibleProvider({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetchImpl,
      timeoutMs: 1000,
    });

    await expect(
      provider.complete({
        messages: [{ role: "user", content: "Hello" }],
        tools,
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
