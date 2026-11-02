"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/require-user";
import {
  adjustStock,
  createProduct,
  setProductActive,
  updateProduct,
} from "@/modules/products/service";

export type ActionState =
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

export async function createProductAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireOwner();
  const result = await createProduct(
    formDataToObject(formData),
    user.username,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProductAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireOwner();
  const id = String(formData.get("productId") ?? "");
  const result = await updateProduct(
    id,
    formDataToObject(formData),
    user.username,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}/edit`);
  redirect("/products");
}

export async function adjustStockAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireOwner();
  const productId = String(formData.get("productId") ?? "");
  const result = await adjustStock(
    formDataToObject(formData),
    user.username,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}/edit`);

  return { ok: true };
}

export async function toggleProductActiveAction(
  formData: FormData,
): Promise<void> {
  await requireOwner();
  const id = String(formData.get("productId") ?? "");
  const isActive = formData.get("isActive") === "true";

  await setProductActive(id, isActive);

  revalidatePath("/products");
  revalidatePath(`/products/${id}/edit`);
}
