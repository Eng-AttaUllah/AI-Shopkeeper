/**
 * Provider-agnostic chat types.
 *
 * The assistant talks to any OpenAI-compatible chat-completions endpoint
 * through this small interface. No vendor SDK is imported, and the API key
 * never reaches the browser. See `docs/architecture.md`.
 */

export type ToolCall = {
  id: string;
  name: string;
  /** JSON text exactly as returned by the model. Validated before execution. */
  arguments: string;
  /**
   * Provider-specific metadata that must be echoed back with the call, such as
   * Gemini's `thought_signature`. Opaque to the app; never executed.
   */
  extraContent?: Record<string, unknown>;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ChatRequest = {
  messages: ChatMessage[];
  tools: ToolDefinition[];
};

export type AssistantTurn = {
  content: string | null;
  toolCalls: ToolCall[];
};

export interface ChatProvider {
  complete(request: ChatRequest): Promise<AssistantTurn>;
}

/** A provider failure with a message that is safe to show the shopkeeper. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
