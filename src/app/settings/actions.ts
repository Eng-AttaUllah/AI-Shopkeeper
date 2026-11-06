"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import {
  changeUserPassword,
  signOutEverywhere,
} from "@/modules/settings/service";

export type ChangePasswordState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function changePasswordAction(
  _previousState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const result = await changeUserPassword(user.id, {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  // The tokenVersion bump has already signed out every session, including
  // this one, so the only useful next screen is sign-in.
  redirect("/login?changed=1");
}

export async function signOutEverywhereAction(): Promise<void> {
  const user = await requireUser();

  await signOutEverywhere(user.id);

  redirect("/login?signedOutEverywhere=1");
}
