"use server";

import { revalidatePath } from "next/cache";

import { requireShopkeeper } from "@/lib/require-user";
import { createExpense } from "@/modules/expenses/service";

export type ExpenseActionState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

function formDataToObject(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return values;
}

export async function createExpenseAction(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const { shop } = await requireShopkeeper();
  const result = await createExpense(
    shop.id,
    formDataToObject(formData),
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/");

  return { ok: true };
}
