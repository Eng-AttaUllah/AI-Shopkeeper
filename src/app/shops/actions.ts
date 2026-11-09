"use server";

import { redirect } from "next/navigation";

import { requireActiveMembership } from "@/lib/require-user";
import { createJoinRequest } from "@/modules/customers/service";

export type ShopJoinActionState =
  | { ok: true }
  | { ok: false; error?: string };

export async function joinShopAction(
  _previousState: ShopJoinActionState,
  formData: FormData,
): Promise<ShopJoinActionState> {
  const { user } = await requireActiveMembership();
  const shopId = String(formData.get("shopId") ?? "");

  if (!shopId) {
    return { ok: false, error: "The shop could not be found." };
  }

  const result = await createJoinRequest(shopId, user.id);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  redirect("/shops");
}
