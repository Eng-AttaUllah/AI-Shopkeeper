"use server";

import { revalidatePath } from "next/cache";

import { getChatProvider, isAssistantConfigured } from "@/lib/ai/config";
import { requireUser } from "@/lib/require-user";
import { fail, ok, type Result } from "@/lib/result";
import { confirmSaleProposal } from "@/modules/assistant/confirm-sale";
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
 * page. Asking is read-only: it never revalidates or writes a path. A sale is
 * only written by `confirmSaleProposalAction` after the shopkeeper presses the
 * confirmation button.
 */
export async function askAssistantAction(
  input: AssistantRequestInput,
): Promise<Result<AssistantAnswer>> {
  const user = await requireUser();

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
      userId: user.id,
    });
  } catch (error) {
    console.error("Assistant action failed:", error);

    return fail("The assistant could not answer right now. Please try again.");
  }
}

export type ConfirmSaleProposalActionResult = {
  saleId: string;
  number: string;
  totalPaisa: number;
  alreadyConfirmed: boolean;
};

/**
 * Write a sale that the shopkeeper explicitly confirmed.
 *
 * The token is signed, bound to this user, and short-lived. The sale service
 * re-prices the draft inside its transaction and refuses to write if the
 * preview no longer matches, so the shopkeeper never gets a different sale
 * from the one they confirmed.
 */
export async function confirmSaleProposalAction(
  token: string,
): Promise<Result<ConfirmSaleProposalActionResult>> {
  const user = await requireUser();

  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 50_000
  ) {
    return fail(
      "This proposal is not valid. Ask the assistant to prepare it again.",
    );
  }

  try {
    const result = await confirmSaleProposal({
      token,
      userId: user.id,
      actor: user.username,
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/");
    revalidatePath("/sell");
    revalidatePath("/products");
    revalidatePath("/sales");
    revalidatePath("/customers");

    return ok({
      saleId: result.data.sale.id,
      number: result.data.sale.number,
      totalPaisa: result.data.sale.totalPaisa,
      alreadyConfirmed: result.data.alreadyConfirmed,
    });
  } catch (error) {
    console.error("Sale proposal confirmation failed:", error);

    return fail("The sale could not be confirmed. Please try again.");
  }
}
