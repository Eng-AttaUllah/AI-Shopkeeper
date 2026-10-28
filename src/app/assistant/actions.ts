"use server";

import { getChatProvider, isAssistantConfigured } from "@/lib/ai/config";
import { requireUser } from "@/lib/require-user";
import { fail, type Result } from "@/lib/result";
import {
  assistantRequestSchema,
  type AssistantHistoryTurn,
} from "@/modules/assistant/schema";
import {
  answerShopQuestion,
  type AssistantAnswer,
} from "@/modules/assistant/service";

type AssistantRequestInput = {
  question: string;
  history: AssistantHistoryTurn[];
};

/**
 * Server action for the assistant chat.
 *
 * The session is enforced here even though the proxy already protects the
 * page. The action is read-only: it never revalidates or writes a path.
 */
export async function askAssistantAction(
  input: AssistantRequestInput,
): Promise<Result<AssistantAnswer>> {
  await requireUser();

  const parsed = assistantRequestSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Enter a question.");
  }

  if (!isAssistantConfigured()) {
    return fail(
      "The assistant is not configured. Add AI_BASE_URL and AI_MODEL to .env, then restart the app.",
    );
  }

  try {
    return await answerShopQuestion({
      question: parsed.data.question,
      history: parsed.data.history,
      provider: getChatProvider(),
    });
  } catch (error) {
    console.error("Assistant action failed:", error);

    return fail("The assistant could not answer right now. Please try again.");
  }
}
