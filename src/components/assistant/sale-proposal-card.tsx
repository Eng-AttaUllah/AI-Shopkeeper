"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "cn";

import {
  confirmSaleProposalAction,
  type ConfirmSaleProposalActionResult,
} from "@/app/assistant/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import { readClientLocale, translate } from "@/lib/dictionary";
import type { SaleProposal } from "@/modules/assistant/proposal-schema";

type SaleProposalCardProps = {
  proposal: SaleProposal;
};

/**
 * The only place an assistant-prepared sale becomes real. The model cannot
 * press this button; the signed-in shopkeeper must. Nothing is written until
 * the server verifies the signed proposal and re-prices it.
 */
export function SaleProposalCard({ proposal }: SaleProposalCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] =
    useState<ConfirmSaleProposalActionResult | null>(null);
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
            ? t("proposal.saleAlreadyRecorded")
            : t("proposal.saleRecorded")}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Receipt {confirmed.number} · {formatPaisa(confirmed.totalPaisa)}
        </p>
        <div className="mt-3">
          <Link
            href={`/sales/${confirmed.saleId}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-11 px-4 text-base",
            )}
          >
            {t("proposal.receipt")}
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
        const result = await confirmSaleProposalAction(proposal.token);

        if (result.ok) {
          setConfirmed(result.data);
        } else {
          setError(result.error);
        }
      } catch (requestError) {
        console.error("Sale proposal confirmation failed:", requestError);
        setError(
          "The sale could not be confirmed. Check the connection and try again.",
        );
      }
    });
  }

  return (
    <section className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
          {t("proposal.notSaved", { kind: t("proposal.kind.sale") })}
        </span>
        <span className="text-sm text-ink-muted">
          {t("proposal.expires", {
            date: formatDateTime(new Date(proposal.expiresAt)),
          })}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-line">
        {preview.lines.map((line) => (
          <li
            key={line.productId}
            className="flex items-start justify-between gap-3 py-2"
          >
            <div>
              <p className="font-medium">{line.productName}</p>
              <p className="text-sm text-ink-muted">
                {formatQuantity(line.quantityMilli, line.unit)} ×{" "}
                {formatPaisa(line.unitPricePaisa)}
              </p>
            </div>
            <p className="font-medium tabular-nums">
              {formatPaisa(line.lineTotalPaisa)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t("label.total")}</dt>
          <dd className="tabular-nums">{formatPaisa(preview.subtotalPaisa)}</dd>
        </div>
        {preview.discountPaisa > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Discount</dt>
            <dd className="tabular-nums">
              {formatPaisa(preview.discountPaisa)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPaisa(preview.totalPaisa)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Payment</dt>
          <dd>
            {preview.paymentMethod === "CREDIT" ? t("proposal.paymentCredit") : t("proposal.paymentCash")}
          </dd>
        </div>
        {preview.customerName ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("proposal.customer")}</dt>
            <dd>{preview.customerName}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t("proposal.cashReceived")}</dt>
          <dd className="tabular-nums">{formatPaisa(preview.paidPaisa)}</dd>
        </div>
        {preview.changePaisa > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("proposal.change")}</dt>
            <dd className="tabular-nums">{formatPaisa(preview.changePaisa)}</dd>
          </div>
        ) : null}
      </dl>

      {preview.note ? (
        <p className="mt-2 text-sm text-ink-muted">
          {t("proposal.note")}: {preview.note}
        </p>
      ) : null}

      <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-muted">
        {t("proposal.nothingSaved", { action: t("proposal.confirmSale") })}
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
          {pending ? "Recording…" : t("proposal.confirmSale")}
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
