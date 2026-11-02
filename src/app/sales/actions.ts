"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/require-user";
import { createSale, voidSale } from "@/modules/sales/service";

export type SaleActionState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

const UNREADABLE_CART =
  "The cart could not be read. Please reload the page and try again.";

export async function createSaleAction(
  _previousState: SaleActionState,
  formData: FormData,
): Promise<SaleActionState> {
  const user = await requireOwner();
  const payload = formData.get("payload");

  if (typeof payload !== "string" || payload.length === 0) {
    return { ok: false, error: UNREADABLE_CART };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    return { ok: false, error: UNREADABLE_CART };
  }

  const result = await createSale(parsed, user.username);

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/sell");
  revalidatePath("/products");
  revalidatePath("/sales");

  redirect(`/sales/${result.data.id}`);
}

export async function voidSaleAction(
  _previousState: SaleActionState,
  formData: FormData,
): Promise<SaleActionState> {
  const user = await requireOwner();
  const saleId = String(formData.get("saleId") ?? "");
  const reason = formData.get("reason");

  if (!saleId) {
    return { ok: false, error: "The sale could not be found." };
  }

  const result = await voidSale(
    saleId,
    {
      reason: typeof reason === "string" ? reason : "",
    },
    user.username,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/reports");
  revalidatePath("/customers");

  if (result.data.customerId) {
    revalidatePath(`/customers/${result.data.customerId}`);
  }

  return { ok: true };
}
