import { createOpenAiCompatibleProvider } from "./openai-compatible";
import { ProviderError, type ChatProvider } from "./types";

type AssistantConfig = {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

function readConfig(): AssistantConfig {
  return {
    baseUrl: process.env.AI_BASE_URL?.trim() || undefined,
    model: process.env.AI_MODEL?.trim() || undefined,
    apiKey: process.env.AI_API_KEY?.trim() || undefined,
  };
}

/**
 * The assistant is optional. The rest of the app keeps working without these
 * values; the assistant page shows setup instructions until both are present.
 */
export function isAssistantConfigured(): boolean {
  const { baseUrl, model } = readConfig();

  return Boolean(baseUrl && model);
}

export function getChatProvider(): ChatProvider {
  const { baseUrl, model, apiKey } = readConfig();

  if (!baseUrl || !model) {
    throw new ProviderError("The assistant is not configured.");
  }

  return createOpenAiCompatibleProvider({
    baseUrl,
    model,
    apiKey,
  });
}
