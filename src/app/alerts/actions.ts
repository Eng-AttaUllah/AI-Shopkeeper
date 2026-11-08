"use server";

import { revalidatePath } from "next/cache";

import { requireShopkeeper } from "@/lib/require-user";
import { reviewCameraAlert } from "@/modules/camera/service";

export type AlertActionState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function markAlertReviewedAction(
  _previousState: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const { shop } = await requireShopkeeper();
  const result = await reviewCameraAlert(
    shop.id,
    {
      alertId: String(formData.get("alertId") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
    },
    "REVIEWED",
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/alerts");

  return { ok: true };
}

export async function dismissAlertAction(
  _previousState: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const { shop } = await requireShopkeeper();
  const result = await reviewCameraAlert(
    shop.id,
    {
      alertId: String(formData.get("alertId") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
    },
    "DISMISSED",
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/alerts");

  return { ok: true };
}
