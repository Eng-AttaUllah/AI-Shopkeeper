"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createCustomer,
  recordPayment,
  updateCustomer,
} from "@/modules/customers/service";

export type CustomerActionState =
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

export async function createCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const result = await createCustomer(formDataToObject(formData));

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/customers");
  revalidatePath("/sell");
  redirect("/customers");
}

export async function updateCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const id = String(formData.get("customerId") ?? "");
  const result = await updateCustomer(id, formDataToObject(formData));

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/sell");
  redirect(`/customers/${id}`);
}

export async function recordPaymentAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const customerId = String(formData.get("customerId") ?? "");
  const result = await recordPayment(formDataToObject(formData));

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/sell");

  return { ok: true };
}
