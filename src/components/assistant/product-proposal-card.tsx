"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "cn";

import {
  confirmProductProposalAction,
  type ConfirmProductProposalActionResult,
} from "@/app/assistant/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import type { ProductProposal } from "@/modules/assistant/proposal-schema";

type ProductProposalCardProps = {
  proposal: ProductProposal;
};

/**
 * The only place an assistant-prepared product becomes real. The model cannot
 * press this button; the signed-in shopkeeper must.
 */
export function ProductProposalCard({ proposal }: ProductProposalCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] =
    useState<ConfirmProductProposalActionResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  if (confirmed) {
    return (
      <section className="mt-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <p className="font-medium text-success">
          {confirmed.alreadyConfirmed
            ? "This product was already created."
            : "Product created."}
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

  function confirm() {
    if (pending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await confirmProductProposalAction(proposal.token);

        if (result.ok) {
          setConfirmed(result.data);
        } else {
          setError(result.error);
        }
      } catch (requestError) {
        console.error("Product proposal confirmation failed:", requestError);
        setError(
          "The product could not be confirmed. Check the connection and try again.",
        );
      }
    });
  }

  return (
    <section className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
          Proposed product — not saved yet
        </span>
        <span className="text-sm text-ink-muted">
          Expires {formatDateTime(new Date(proposal.expiresAt))}
        </span>
      </div>

      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3 text-base font-semibold">
          <dt>Name</dt>
          <dd>{preview.name}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Unit</dt>
          <dd>{preview.unit}</dd>
        </div>
        {preview.category ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Category</dt>
            <dd>{preview.category}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Cost price</dt>
          <dd className="tabular-nums">
            {formatPaisa(preview.costPricePaisa)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Sale price</dt>
          <dd className="tabular-nums">
            {formatPaisa(preview.salePricePaisa)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Opening stock</dt>
          <dd className="tabular-nums">
            {formatQuantity(preview.openingStockMilli, preview.unit)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Low-stock level</dt>
          <dd className="tabular-nums">
            {formatQuantity(preview.lowStockMilli, preview.unit)}
          </dd>
        </div>
        {preview.barcode ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Barcode</dt>
            <dd>{preview.barcode}</dd>
          </div>
        ) : null}
        {preview.aliases.length > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Also called</dt>
            <dd>{preview.aliases.join(", ")}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-muted">
        Nothing has been saved. Press{" "}
        <span className="font-medium text-ink">Confirm product</span> to create
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
          {pending ? "Creating…" : "Confirm product"}
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
