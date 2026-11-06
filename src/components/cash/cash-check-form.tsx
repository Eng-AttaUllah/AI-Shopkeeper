"use client";

import { useActionState } from "react";

import type { CashCheckState } from "@/app/day-close/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";
import { formatPaisa } from "@/lib/format";

type CashCheckFormProps = {
  today: string;
  action: (
    state: CashCheckState,
    formData: FormData,
  ) => Promise<CashCheckState>;
};

export function CashCheckForm({ today, action }: CashCheckFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const error = state.ok ? undefined : state.error;
  const errors = (state.ok ? {} : state.fieldErrors) ?? {};

  const differenceLabel = state.ok
    ? state.differencePaisa === 0
      ? t("dayClose.balanced")
      : state.differencePaisa > 0
        ? t("dayClose.overBy", { amount: formatPaisa(state.differencePaisa) })
        : t("dayClose.shortBy", { amount: formatPaisa(-state.differencePaisa) })
    : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      ) : null}

      {state.ok ? (
        <div
          role="status"
          className="rounded-lg border border-success/30 bg-success/5 px-3 py-3 text-sm"
        >
          <p className="font-medium text-success">
            {t("dayClose.cashCheckSavedFor", { date: state.dateLabel })}
          </p>
          <dl className="mt-2 flex flex-col gap-1">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("dayClose.expected")}</dt>
              <dd className="tabular-nums">
                {formatPaisa(state.expectedPaisa)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("dayClose.counted")}</dt>
              <dd className="tabular-nums">
                {formatPaisa(state.countedPaisa)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 font-medium">
              <dt>{t("dayClose.difference")}</dt>
              <dd
                className={
                  state.differencePaisa === 0
                    ? "tabular-nums text-success"
                    : "tabular-nums text-error"
                }
              >
                {differenceLabel}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cash-date">{t("dayClose.day")}</Label>
          <Input
            id="cash-date"
            name="date"
            type="date"
            defaultValue={today}
            required
            className="h-11 text-base"
            aria-invalid={Boolean(errors.date)}
          />
          {errors.date ? (
            <p className="text-sm text-error">{errors.date}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cash-counted">{t("dayClose.countedCash")}</Label>
          <Input
            id="cash-counted"
            name="counted"
            inputMode="decimal"
            autoComplete="off"
            placeholder="12500"
            required
            className="h-11 text-base"
            aria-invalid={Boolean(errors.counted)}
            dir="ltr"
          />
          {errors.counted ? (
            <p className="text-sm text-error">{errors.counted}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="cash-note">{t("proposal.note")} (optional)</Label>
          <Input
            id="cash-note"
            name="note"
            autoComplete="off"
            placeholder={t("dayClose.rsKeptForChange")}
            className="h-11 text-base"
            aria-invalid={Boolean(errors.note)}
            dir="auto"
          />
          {errors.note ? (
            <p className="text-sm text-error">{errors.note}</p>
          ) : null}
        </div>
      </div>

      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-5 text-base sm:w-auto"
        >
          {pending ? t("dayClose.saving") : t("dayClose.saveCheck")}
        </Button>
      </div>
    </form>
  );
}
