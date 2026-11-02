"use server";

import { revalidatePath } from "next/cache";

import { getChatProvider, isAssistantConfigured } from "@/lib/ai/config";
import { getLocale } from "@/lib/i18n";
import { requireOwner } from "@/lib/require-user";
import { fail, ok, type Result } from "@/lib/result";
import { confirmCustomerProposal } from "@/modules/assistant/confirm-customer";
import { confirmExpenseProposal } from "@/modules/assistant/confirm-expense";
import { confirmPaymentProposal } from "@/modules/assistant/confirm-payment";
import { confirmProductProposal } from "@/modules/assistant/confirm-product";
import { confirmProductUpdateProposal } from "@/modules/assistant/confirm-product-update";
import { confirmSaleProposal } from "@/modules/assistant/confirm-sale";
import { confirmStockAdjustmentProposal } from "@/modules/assistant/confirm-stock-adjustment";
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
  const user = await requireOwner();

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
      locale: await getLocale(),
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
  const user = await requireOwner();

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
  const user = await requireOwner();

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
  const user = await requireOwner();

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

export type ConfirmCustomerProposalActionResult = {
  customerId: string;
  name: string;
  alreadyConfirmed: boolean;
};

/**
 * Write a customer that the shopkeeper explicitly confirmed.
 *
 * The token is signed, bound to this user, and short-lived. The customer
 * service writes the draft and audit row in one transaction, and the unique
 * proposal id makes a replay idempotent.
 */
export async function confirmCustomerProposalAction(
  token: string,
): Promise<Result<ConfirmCustomerProposalActionResult>> {
  const user = await requireOwner();

  if (!isValidProposalToken(token)) {
    return invalidProposalToken();
  }

  try {
    const result = await confirmCustomerProposal({
      token,
      userId: user.id,
      actor: user.username,
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/");
    revalidatePath("/customers");
    revalidatePath("/sell");

    return ok({
      customerId: result.data.customer.id,
      name: result.data.customer.name,
      alreadyConfirmed: result.data.alreadyConfirmed,
    });
  } catch (error) {
    console.error("Customer proposal confirmation failed:", error);

    return fail("The customer could not be confirmed. Please try again.");
  }
}

export type ConfirmProductProposalActionResult = {
  productId: string;
  name: string;
  alreadyConfirmed: boolean;
};

/**
 * Write a product and its opening stock that the shopkeeper explicitly
 * confirmed. The token is signed, bound to this user, and short-lived.
 */
export async function confirmProductProposalAction(
  token: string,
): Promise<Result<ConfirmProductProposalActionResult>> {
  const user = await requireOwner();

  if (!isValidProposalToken(token)) {
    return invalidProposalToken();
  }

  try {
    const result = await confirmProductProposal({
      token,
      userId: user.id,
      actor: user.username,
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/sell");

    return ok({
      productId: result.data.product.id,
      name: result.data.product.name,
      alreadyConfirmed: result.data.alreadyConfirmed,
    });
  } catch (error) {
    console.error("Product proposal confirmation failed:", error);

    return fail("The product could not be confirmed. Please try again.");
  }
}

export type ConfirmProductUpdateProposalActionResult = {
  productId: string;
  name: string;
  alreadyConfirmed: boolean;
};

/**
 * Write a product edit that the shopkeeper explicitly confirmed.
 *
 * The signed before-state is re-checked inside the transaction, so a product
 * changed after the proposal was prepared is rejected instead of silently
 * overwritten.
 */
export async function confirmProductUpdateProposalAction(
  token: string,
): Promise<Result<ConfirmProductUpdateProposalActionResult>> {
  const user = await requireOwner();

  if (!isValidProposalToken(token)) {
    return invalidProposalToken();
  }

  try {
    const result = await confirmProductUpdateProposal({
      token,
      userId: user.id,
      actor: user.username,
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath(`/products/${result.data.product.id}`);
    revalidatePath("/sell");

    return ok({
      productId: result.data.product.id,
      name: result.data.product.name,
      alreadyConfirmed: result.data.alreadyConfirmed,
    });
  } catch (error) {
    console.error("Product update proposal confirmation failed:", error);

    return fail("The product changes could not be confirmed. Please try again.");
  }
}

export type ConfirmStockAdjustmentProposalActionResult = {
  productId: string;
  productName: string;
  newStockMilli: number;
  unit: string;
  alreadyConfirmed: boolean;
};

/**
 * Write a stock adjustment that the shopkeeper explicitly confirmed.
 *
 * The stock service re-reads the current quantity inside the transaction and
 * refuses the write if it changed, so the owner never applies an adjustment to
 * a different stock level from the one they saw.
 */
export async function confirmStockAdjustmentProposalAction(
  token: string,
): Promise<Result<ConfirmStockAdjustmentProposalActionResult>> {
  const user = await requireOwner();

  if (!isValidProposalToken(token)) {
    return invalidProposalToken();
  }

  try {
    const result = await confirmStockAdjustmentProposal({
      token,
      userId: user.id,
      actor: user.username,
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath(`/products/${result.data.product.id}`);
    revalidatePath("/sell");
    revalidatePath("/reports");

    return ok({
      productId: result.data.product.id,
      productName: result.data.product.name,
      newStockMilli: result.data.product.stockMilli,
      unit: result.data.product.unit,
      alreadyConfirmed: result.data.alreadyConfirmed,
    });
  } catch (error) {
    console.error("Stock adjustment proposal confirmation failed:", error);

    return fail("The stock adjustment could not be confirmed. Please try again.");
  }
}
