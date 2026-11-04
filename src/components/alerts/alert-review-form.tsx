"use client";

import { useActionState } from "react";

import type { AlertActionState } from "@/app/alerts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";

type AlertReviewFormProps = {
  alertId: string;
  reviewedAction: (
    state: AlertActionState,
    formData: FormData,
  ) => Promise<AlertActionState>;
  dismissedAction: (
    state: AlertActionState,
    formData: FormData,
  ) => Promise<AlertActionState>;
};

export function AlertReviewForm({
  alertId,
  reviewedAction,
  dismissedAction,
}: AlertReviewFormProps) {
  const [reviewedState, reviewAction, reviewPending] = useActionState(
    reviewedAction,
    { ok: false } as AlertActionState,
  );
  const [dismissedState, dismissAction, dismissPending] = useActionState(
    dismissedAction,
    { ok: false } as AlertActionState,
  );
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const error = !reviewedState.ok && reviewedState.error
    ? reviewedState.error
    : !dismissedState.ok && dismissedState.error
      ? dismissedState.error
      : undefined;

  return (
    <form className="mt-3 flex flex-col gap-3" action={reviewAction}>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      ) : null}

      <input type="hidden" name="alertId" value={alertId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`note-${alertId}`}>{t("alerts.noteOptional")}</Label>
        <Input
          id={`note-${alertId}`}
          name="note"
          autoComplete="off"
          className="h-11 text-base"
          dir="auto"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          formAction={reviewAction}
          disabled={reviewPending}
          className="h-11 px-4 text-base"
        >
          {reviewPending ? t("alerts.saving") : t("alerts.markReviewed")}
        </Button>
        <Button
          type="submit"
          formAction={dismissAction}
          variant="outline"
          disabled={dismissPending}
          className="h-11 px-4 text-base"
        >
          {dismissPending ? t("alerts.saving") : t("alerts.dismiss")}
        </Button>
      </div>
    </form>
  );
}
