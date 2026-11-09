"use server";

import { redirect } from "next/navigation";

import { requireShopkeeper, requireUser } from "@/lib/require-user";
import {
  approveJoinRequest,
  listJoinRequests,
  rejectJoinRequest,
} from "@/modules/customers/service";
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

export async function approveJoinRequestAction(
  _previousState: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const { shop } = await requireShopkeeper();
  const membershipId = String(formData.get("membershipId") ?? "");
  const linkToCustomerId = String(formData.get("linkToCustomerId") ?? "") || undefined;
  const createCustomerName = String(formData.get("createCustomerName") ?? "") || undefined;
  const createCustomerPhone = String(formData.get("createCustomerPhone") ?? "") || undefined;
  const createCustomerNote = String(formData.get("createCustomerNote") ?? "") || undefined;

  const result = await approveJoinRequest(shop.id, membershipId, {
    linkToCustomerId,
    createCustomerName,
    createCustomerPhone,
    createCustomerNote,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

export async function rejectJoinRequestAction(
  _previousState: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const { shop } = await requireShopkeeper();
  const membershipId = String(formData.get("membershipId") ?? "");

  const result = await rejectJoinRequest(shop.id, membershipId);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

export async function listJoinRequestsAction(): Promise<{
  memberships: Array<{
    membershipId: string;
    username: string;
    createdAt: Date;
  }>;
}> {
  const { shop } = await requireShopkeeper();

  const memberships = await listJoinRequests(shop.id);

  return {
    memberships: memberships.map((m) => ({
      membershipId: m.id,
      username: m.user.username,
      createdAt: m.createdAt,
    })),
  };
}
