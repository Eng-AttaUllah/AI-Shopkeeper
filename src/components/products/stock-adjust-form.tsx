"use client";

import { useActionState } from "react";

import type { ActionState } from "@/app/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";

const REASON_OPTIONS = [
  { value: "RESTOCK", label: "New stock received" },
  { value: "DAMAGE", label: "Damaged or lost" },
  { value: "CORRECTION", label: "Counting correction" },
  { value: "OTHER", label: "Other" },
] as const;

type StockAdjustFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  productId: string;
  unit: string;
};

export function StockAdjustForm({
  action,
  productId,
  unit,
}: StockAdjustFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const error = state.ok ? undefined : state.error;
  const errors = (state.ok ? {} : state.fieldErrors) ?? {};
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  function reasonLabel(value: string): string {
    switch (value) {
      case "RESTOCK":
        return t("products.newStock");
      case "DAMAGE":
        return t("products.damagedOrLost");
      case "CORRECTION":
        return t("products.countingCorrection");
      case "OTHER":
        return t("products.other");
      default:
        return value;
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />

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
          {t("products.stockUpdated")}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">{t("products.quantityChange", { unit })}</Label>
          <Input
            id="quantity"
            name="quantity"
            placeholder="10 or -2.5"
            inputMode="decimal"
            autoComplete="off"
            required
            className="h-11 text-base"
            aria-invalid={Boolean(errors.quantity)}
          />
          <p className="text-sm text-ink-muted">
            {t("products.positiveAdds")}
          </p>
          {errors.quantity ? (
            <p className="text-sm text-error">{errors.quantity}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">{t("products.reason")}</Label>
          <select
            id="reason"
            name="reason"
            defaultValue="RESTOCK"
            className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          >
            {REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {reasonLabel(option.value)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="note">{t("products.noteOptional")}</Label>
          <Input
            id="note"
            name="note"
            placeholder={t("products.deliveryFromSupplier")}
            autoComplete="off"
            className="h-11 text-base"
          />
        </div>
      </div>

      <div>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="h-11 px-5 text-base"
        >
          {pending ? t("products.updating") : t("products.updateStock")}
        </Button>
      </div>
    </form>
  );
}
