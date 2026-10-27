"use client";

import { useActionState } from "react";

import type { CashCheckState } from "@/app/day-close/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const error = state.ok ? undefined : state.error;
  const errors = (state.ok ? {} : state.fieldErrors) ?? {};

  const differenceLabel = state.ok
    ? state.differencePaisa === 0
      ? "Balanced"
      : state.differencePaisa > 0
        ? `Over by ${formatPaisa(state.differencePaisa)}`
        : `Short by ${formatPaisa(-state.differencePaisa)}`
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
            Cash check saved for {state.dateLabel}.
          </p>
          <dl className="mt-2 flex flex-col gap-1">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Expected</dt>
              <dd className="tabular-nums">
                {formatPaisa(state.expectedPaisa)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Counted</dt>
              <dd className="tabular-nums">
                {formatPaisa(state.countedPaisa)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 font-medium">
              <dt>Difference</dt>
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
          <Label htmlFor="cash-date">Day</Label>
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
          <Label htmlFor="cash-counted">Counted cash (Rs.)</Label>
          <Input
            id="cash-counted"
            name="counted"
            inputMode="decimal"
            autoComplete="off"
            placeholder="12500"
            required
            className="h-11 text-base"
            aria-invalid={Boolean(errors.counted)}
          />
          {errors.counted ? (
            <p className="text-sm text-error">{errors.counted}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="cash-note">Note (optional)</Label>
          <Input
            id="cash-note"
            name="note"
            autoComplete="off"
            placeholder="Rs. 200 kept for change"
            className="h-11 text-base"
            aria-invalid={Boolean(errors.note)}
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
          {pending ? "Saving…" : "Save cash check"}
        </Button>
      </div>
    </form>
  );
}
