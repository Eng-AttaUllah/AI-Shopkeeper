"use client";

import { useActionState } from "react";

import type { ShopJoinActionState } from "@/app/shops/actions";
import { joinShopAction } from "@/app/shops/actions";
import { Button } from "@/components/ui/button";
import { readClientLocale, translate } from "@/lib/dictionary";

type JoinShopFormProps = {
  shopId: string;
};

export function JoinShopForm({ shopId }: JoinShopFormProps) {
  const [state, formAction, pending] = useActionState<ShopJoinActionState, FormData>(
    joinShopAction,
    { ok: true },
  );
  const error = state.ok ? undefined : state.error;
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="shopId" value={shopId} />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      ) : null}

      {state.ok ? (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
        >
          {t("shops.requestSent")}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-11 px-4 text-base"
      >
        {pending ? t("shops.requesting") : t("shops.requestToJoin")}
      </Button>
    </form>
  );
}
