"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "cn";

import {
  confirmExpenseProposalAction,
  type ConfirmExpenseProposalActionResult,
} from "@/app/assistant/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { karachiDateKeyToDate } from "@/lib/dates";
import { formatDate, formatDateTime, formatPaisa } from "@/lib/format";
import type { ExpenseProposal } from "@/modules/assistant/proposal-schema";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/modules/expenses/schema";

type ExpenseProposalCardProps = {
  proposal: ExpenseProposal;
};

function categoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

/**
 * The only place an assistant-prepared expense becomes real. The model cannot
 * press this button; the signed-in shopkeeper must.
 */
export function ExpenseProposalCard({ proposal }: ExpenseProposalCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] =
    useState<ConfirmExpenseProposalActionResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  if (confirmed) {
    return (
      <section className="mt-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <p className="font-medium text-success">
          {confirmed.alreadyConfirmed
            ? "This expense was already recorded."
            : "Expense recorded."}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {categoryLabel(confirmed.category)} ·{" "}
          {formatPaisa(confirmed.amountPaisa)}
        </p>
        <div className="mt-3">
          <Link
            href="/expenses"
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-11 px-4 text-base",
            )}
          >
            View expenses
          </Link>
        </div>
      </section>
    );
  }

  const preview = proposal.preview;
  const spentAt = karachiDateKeyToDate(preview.date);

  function confirm() {
    if (pending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await confirmExpenseProposalAction(proposal.token);

        if (result.ok) {
          setConfirmed(result.data);
        } else {
          setError(result.error);
        }
      } catch (requestError) {
        console.error("Expense proposal confirmation failed:", requestError);
        setError(
          "The expense could not be confirmed. Check the connection and try again.",
        );
      }
    });
  }

  return (
    <section className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
          Proposed expense — not saved yet
        </span>
        <span className="text-sm text-ink-muted">
          Expires {formatDateTime(new Date(proposal.expiresAt))}
        </span>
      </div>

      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Category</dt>
          <dd>{categoryLabel(preview.category)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-base font-semibold">
          <dt>Amount</dt>
          <dd className="tabular-nums">{formatPaisa(preview.amountPaisa)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Date</dt>
          <dd>{spentAt ? formatDate(spentAt) : preview.date}</dd>
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
        <span className="font-medium text-ink">Confirm expense</span> to record
        it. The assistant cannot confirm it for you.
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
          {pending ? "Recording…" : "Confirm expense"}
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
