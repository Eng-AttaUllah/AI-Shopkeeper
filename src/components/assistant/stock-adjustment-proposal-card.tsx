"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "cn";

import {
  confirmStockAdjustmentProposalAction,
  type ConfirmStockAdjustmentProposalActionResult,
} from "@/app/assistant/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import type { StockAdjustmentProposal } from "@/modules/assistant/proposal-schema";

type StockAdjustmentProposalCardProps = {
  proposal: StockAdjustmentProposal;
};

const REASON_LABELS: Record<string, string> = {
  RESTOCK: "Restock",
  DAMAGE: "Damage or loss",
  CORRECTION: "Stock correction",
  OTHER: "Other",
};

/**
 * The only place an assistant-prepared stock adjustment becomes real. The
 * model cannot press this button; the signed-in shopkeeper must.
 */
export function StockAdjustmentProposalCard({
  proposal,
}: StockAdjustmentProposalCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] =
    useState<ConfirmStockAdjustmentProposalActionResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  if (confirmed) {
    return (
      <section className="mt-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <p className="font-medium text-success">
          {confirmed.alreadyConfirmed
            ? "This stock adjustment was already applied."
            : "Stock adjusted."}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {confirmed.productName} ·{" "}
          {formatQuantity(confirmed.newStockMilli, confirmed.unit)} in stock
        </p>
        <div className="mt-3">
          <Link
            href={`/products/${confirmed.productId}/edit`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-11 px-4 text-base",
            )}
          >
            View product
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
        const result =
          await confirmStockAdjustmentProposalAction(proposal.token);

        if (result.ok) {
          setConfirmed(result.data);
        } else {
          setError(result.error);
        }
      } catch (requestError) {
        console.error(
          "Stock adjustment proposal confirmation failed:",
          requestError,
        );
        setError(
          "The stock adjustment could not be confirmed. Check the connection and try again.",
        );
      }
    });
  }

  return (
    <section className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
          Proposed stock adjustment — not saved yet
        </span>
        <span className="text-sm text-ink-muted">
          Expires {formatDateTime(new Date(proposal.expiresAt))}
        </span>
      </div>

      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3 text-base font-semibold">
          <dt>{preview.productName}</dt>
          <dd className="tabular-nums">
            {preview.deltaMilli > 0 ? "+" : ""}
            {formatQuantity(preview.deltaMilli, preview.unit)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Stock before</dt>
          <dd className="tabular-nums">
            {formatQuantity(preview.beforeMilli, preview.unit)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Stock after</dt>
          <dd className="tabular-nums">
            {formatQuantity(preview.afterMilli, preview.unit)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Reason</dt>
          <dd>{REASON_LABELS[preview.reason] ?? preview.reason}</dd>
        </div>
        {preview.note ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Note</dt>
            <dd>{preview.note}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-muted">
        Nothing has been saved. Press{" "}
        <span className="font-medium text-ink">Confirm adjustment</span> to
        apply it. The assistant cannot confirm it for you.
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
          {pending ? "Saving…" : "Confirm adjustment"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDismissed(true)}
          disabled={pending}
          className="min-h-11 px-4 text-base"
        >
          Dismiss
        </Button>
      </div>
    </section>
  );
}
