"use server";

import { redirect } from "next/navigation";

import { requireActiveMembership } from "@/lib/require-user";
import { joinRequestRateLimiter } from "@/lib/rate-limit";
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

  const limit = joinRequestRateLimiter.check(user.id);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many join requests. Try again in ${Math.ceil(
        limit.resetAfterMs / 1000,
      )} seconds.`,
    };
  }

  const result = await createJoinRequest(shopId, user.id);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  redirect("/shops");
}
