"use client";

import { useActionState } from "react";

import type { SaleActionState } from "@/app/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";

type VoidSaleFormProps = {
  saleId: string;
  action: (
    state: SaleActionState,
    formData: FormData,
  ) => Promise<SaleActionState>;
};

export function VoidSaleForm({ saleId, action }: VoidSaleFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const error = state.ok ? undefined : state.error;
  const errors = (state.ok ? {} : state.fieldErrors) ?? {};
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="saleId" value={saleId} />

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
          {t("void.saleVoided")}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="void-reason">{t("void.reason")}</Label>
        <Input
          id="void-reason"
          name="reason"
          autoComplete="off"
          placeholder={t("void.sayWhy")}
          required
          className="h-11 text-base"
          aria-invalid={Boolean(errors.reason)}
        />
        {errors.reason ? (
          <p className="text-sm text-error">{errors.reason}</p>
        ) : null}
      </div>

      <p className="text-sm text-ink-muted">
        {t("receipt.voidNote")}
      </p>

      <div>
        <Button
          type="submit"
          variant="destructive"
          disabled={pending}
          className="h-11 px-5 text-base"
        >
          {pending ? t("void.voiding") : t("void.voidSale")}
        </Button>
      </div>
    </form>
  );
}
