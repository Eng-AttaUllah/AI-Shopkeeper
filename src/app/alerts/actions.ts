"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/require-user";
import { reviewCameraAlert } from "@/modules/camera/service";

export type AlertActionState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function markAlertReviewedAction(
  _previousState: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const user = await requireOwner();
  const result = await reviewCameraAlert(
    {
      alertId: String(formData.get("alertId") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
    },
    "REVIEWED",
    user.username,
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
  const user = await requireOwner();
  const result = await reviewCameraAlert(
    {
      alertId: String(formData.get("alertId") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
    },
    "DISMISSED",
    user.username,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/alerts");

  return { ok: true };
}
