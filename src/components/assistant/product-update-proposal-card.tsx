"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "cn";

import {
  confirmProductUpdateProposalAction,
  type ConfirmProductUpdateProposalActionResult,
} from "@/app/assistant/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import type { ProductUpdateProposal } from "@/modules/assistant/proposal-schema";
import type { ProductSnapshot } from "@/modules/products/preview";

type ProductUpdateProposalCardProps = {
  proposal: ProductUpdateProposal;
};

type Change = {
  label: string;
  before: string;
  after: string;
};

function changes(before: ProductSnapshot, after: ProductSnapshot): Change[] {
  const rows: Change[] = [];

  if (before.name !== after.name) {
    rows.push({ label: "Name", before: before.name, after: after.name });
  }

  if (before.category !== after.category) {
    rows.push({
      label: "Category",
      before: before.category ?? "None",
      after: after.category ?? "None",
    });
  }

  if (before.unit !== after.unit) {
    rows.push({ label: "Unit", before: before.unit, after: after.unit });
  }

  if (before.costPricePaisa !== after.costPricePaisa) {
    rows.push({
      label: "Cost price",
      before: formatPaisa(before.costPricePaisa),
      after: formatPaisa(after.costPricePaisa),
    });
  }

  if (before.salePricePaisa !== after.salePricePaisa) {
    rows.push({
      label: "Sale price",
      before: formatPaisa(before.salePricePaisa),
      after: formatPaisa(after.salePricePaisa),
    });
  }

  if (before.lowStockMilli !== after.lowStockMilli) {
    rows.push({
      label: "Low-stock level",
      before: formatQuantity(before.lowStockMilli, before.unit),
      after: formatQuantity(after.lowStockMilli, after.unit),
    });
  }

  if (before.barcode !== after.barcode) {
    rows.push({
      label: "Barcode",
      before: before.barcode ?? "None",
      after: after.barcode ?? "None",
    });
  }

  if (before.aliases.join("|") !== after.aliases.join("|")) {
    rows.push({
      label: "Also called",
      before: before.aliases.join(", ") || "None",
      after: after.aliases.join(", ") || "None",
    });
  }

  return rows;
}

/**
 * The only place an assistant-prepared product edit becomes real. The model
 * cannot press this button; the signed-in shopkeeper must.
 */
export function ProductUpdateProposalCard({
  proposal,
}: ProductUpdateProposalCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] =
    useState<ConfirmProductUpdateProposalActionResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  if (confirmed) {
    return (
      <section className="mt-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <p className="font-medium text-success">
          {confirmed.alreadyConfirmed
            ? "These product changes were already applied."
            : "Product updated."}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{confirmed.name}</p>
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
  const rows = changes(preview.before, preview.after);

  function confirm() {
    if (pending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await confirmProductUpdateProposalAction(proposal.token);

        if (result.ok) {
          setConfirmed(result.data);
        } else {
          setError(result.error);
        }
      } catch (requestError) {
        console.error(
          "Product update proposal confirmation failed:",
          requestError,
        );
        setError(
          "The product changes could not be confirmed. Check the connection and try again.",
        );
      }
    });
  }

  return (
    <section className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
          Proposed product change — not saved yet
        </span>
        <span className="text-sm text-ink-muted">
          Expires {formatDateTime(new Date(proposal.expiresAt))}
        </span>
      </div>

      <p className="mt-3 font-medium">{preview.before.name}</p>

      <dl className="mt-2 space-y-2 border-t border-line pt-3 text-sm">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="text-ink-muted line-through">{row.before}</span>
              <span aria-hidden="true">→</span>
              <span className="font-medium">{row.after}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-muted">
        Nothing has been saved. Press{" "}
        <span className="font-medium text-ink">Confirm changes</span> to apply
        them. The assistant cannot confirm it for you.
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
          {pending ? "Saving…" : "Confirm changes"}
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
