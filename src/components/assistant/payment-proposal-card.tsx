"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "cn";

import {
  confirmPaymentProposalAction,
  type ConfirmPaymentProposalActionResult,
} from "@/app/assistant/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { readClientLocale, translate } from "@/lib/dictionary";
import type { PaymentProposal } from "@/modules/assistant/proposal-schema";

type PaymentProposalCardProps = {
  proposal: PaymentProposal;
};

/**
 * The only place an assistant-prepared repayment becomes real. The model
 * cannot press this button; the signed-in shopkeeper must.
 */
export function PaymentProposalCard({ proposal }: PaymentProposalCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] =
    useState<ConfirmPaymentProposalActionResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  if (dismissed) {
    return null;
  }

  if (confirmed) {
    return (
      <section className="mt-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <p className="font-medium text-success">
          {confirmed.alreadyConfirmed
            ? t("proposal.paymentAlreadyRecorded")
            : t("proposal.paymentRecorded")}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {confirmed.customerName} · {formatPaisa(confirmed.amountPaisa)}
        </p>
        <div className="mt-3">
          <Link
            href={`/customers/${confirmed.customerId}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-11 px-4 text-base",
            )}
          >
            {t("proposal.customerRecord")}
          </Link>
        </div>
      </section>
    );
  }

  const preview = proposal.preview;

  function confirm() {
    if (pending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await confirmPaymentProposalAction(proposal.token);

        if (result.ok) {
          setConfirmed(result.data);
        } else {
          setError(result.error);
        }
      } catch (requestError) {
        console.error("Payment proposal confirmation failed:", requestError);
        setError(
          "The payment could not be confirmed. Check the connection and try again.",
        );
      }
    });
  }

  return (
    <section className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
          {t("proposal.notSaved", { kind: t("proposal.kind.payment") })}
        </span>
        <span className="text-sm text-ink-muted">
          {t("proposal.expires", {
            date: formatDateTime(new Date(proposal.expiresAt)),
          })}
        </span>
      </div>

      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t("proposal.customer")}</dt>
          <dd>{preview.customerName}</dd>
        </div>
        <div className="flex justify-between gap-3 text-base font-semibold">
          <dt className="text-ink-muted">{t("label.amount")}</dt>
          <dd className="tabular-nums">{formatPaisa(preview.amountPaisa)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t("proposal.khataBefore")}</dt>
          <dd className="tabular-nums">
            {formatPaisa(preview.balanceBeforePaisa)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t("proposal.khataAfter")}</dt>
          <dd className="tabular-nums">
            {formatPaisa(preview.balanceAfterPaisa)}
          </dd>
        </div>
        {preview.note ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("proposal.note")}</dt>
            <dd>{preview.note}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-muted">
        {t("proposal.nothingSaved", { action: t("proposal.confirmPayment") })}
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="min-h-11 px-4 text-base"
        >
          {pending ? "Recording…" : t("proposal.confirmPayment")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDismissed(true)}
          disabled={pending}
          className="min-h-11 px-4 text-base"
        >
          {t("proposal.dismiss")}
        </Button>
      </div>
    </section>
  );
}
