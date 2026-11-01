"use server";

import { revalidatePath } from "next/cache";

import { getChatProvider, isAssistantConfigured } from "@/lib/ai/config";
import { requireUser } from "@/lib/require-user";
import { fail, ok, type Result } from "@/lib/result";
import { confirmExpenseProposal } from "@/modules/assistant/confirm-expense";
import { confirmPaymentProposal } from "@/modules/assistant/confirm-payment";
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

function isValidProposalToken(token: unknown): token is string {
  return (
    typeof token === "string" && token.length > 0 && token.length <= 50_000
  );
}

function invalidProposalToken(): Result<never> {
  return fail(
    "This proposal is not valid. Ask the assistant to prepare it again.",
  );
}

/**
 * Server action for the assistant chat.
 *
 * The session is enforced here even though the proxy already protects the
 * page. Asking is read-only: it never revalidates or writes a path. A proposal
 * is only written by its confirmation action after the shopkeeper presses the
 * matching confirmation button.
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

  if (!isValidProposalToken(token)) {
    return invalidProposalToken();
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

export type ConfirmExpenseProposalActionResult = {
  expenseId: string;
  category: string;
  amountPaisa: number;
  alreadyConfirmed: boolean;
};

/**
 * Write an expense that the shopkeeper explicitly confirmed.
 *
 * The token is signed, bound to this user, and short-lived. The expense
 * service writes the draft and its audit row in one transaction, and the
 * unique proposal id makes a replay idempotent.
 */
export async function confirmExpenseProposalAction(
  token: string,
): Promise<Result<ConfirmExpenseProposalActionResult>> {
  const user = await requireUser();

  if (!isValidProposalToken(token)) {
    return invalidProposalToken();
  }

  try {
    const result = await confirmExpenseProposal({
      token,
      userId: user.id,
      actor: user.username,
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/reports");

    return ok({
      expenseId: result.data.expense.id,
      category: result.data.expense.category,
      amountPaisa: result.data.expense.amountPaisa,
      alreadyConfirmed: result.data.alreadyConfirmed,
    });
  } catch (error) {
    console.error("Expense proposal confirmation failed:", error);

    return fail("The expense could not be confirmed. Please try again.");
  }
}

export type ConfirmPaymentProposalActionResult = {
  paymentId: string;
  customerId: string;
  customerName: string;
  amountPaisa: number;
  alreadyConfirmed: boolean;
};

/**
 * Write a repayment that the shopkeeper explicitly confirmed.
 *
 * The token is signed, bound to this user, and short-lived. The payment
 * service re-reads the khata balance inside its transaction and refuses to
 * write if it changed, so the owner never records a payment against a stale
 * balance.
 */
export async function confirmPaymentProposalAction(
  token: string,
): Promise<Result<ConfirmPaymentProposalActionResult>> {
  const user = await requireUser();

  if (!isValidProposalToken(token)) {
    return invalidProposalToken();
  }

  try {
    const result = await confirmPaymentProposal({
      token,
      userId: user.id,
      actor: user.username,
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/");
    revalidatePath("/customers");
    revalidatePath(`/customers/${result.data.payment.customerId}`);
    revalidatePath("/day-close");
    revalidatePath("/reports");

    return ok({
      paymentId: result.data.payment.id,
      customerId: result.data.payment.customerId,
      customerName: result.data.customerName,
      amountPaisa: result.data.payment.amountPaisa,
      alreadyConfirmed: result.data.alreadyConfirmed,
    });
  } catch (error) {
    console.error("Payment proposal confirmation failed:", error);

    return fail("The payment could not be confirmed. Please try again.");
  }
}
