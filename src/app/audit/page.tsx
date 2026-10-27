import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listAuditLogs } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  PRODUCT_CREATED: "Product created",
  PRODUCT_UPDATED: "Product updated",
  STOCK_ADJUSTED: "Stock adjusted",
  SALE_CREATED: "Sale recorded",
  SALE_VOIDED: "Sale voided",
  PAYMENT_RECORDED: "Repayment",
  EXPENSE_RECORDED: "Expense",
  CASH_RECONCILED: "Cash check",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase();
}

function actorLabel(actor: string): string {
  return actor === "local" ? "local user" : actor;
}

function prettyDetails(details: string | null): string | null {
  if (!details) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

export default async function AuditPage() {
  const entries = await listAuditLogs(100);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every money and stock change, newest first.
          </p>
        </div>
        <Link
          href="/more"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 px-4 text-base",
          })}
        >
          More tools
        </Link>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">Nothing has been recorded yet.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Sales, stock changes, repayments, expenses, and cash checks appear
            here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => {
            const details = prettyDetails(entry.details);

            return (
              <li
                key={entry.id}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.summary}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {formatDateTime(entry.createdAt)} · by{" "}
                      {actorLabel(entry.actor)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      entry.action === "SALE_VOIDED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {actionLabel(entry.action)}
                  </Badge>
                </div>

                {entry.before || entry.after || details ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-ink-muted">
                      Before / after
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-ink-muted">
                          Before
                        </p>
                        <pre className="mt-1 overflow-x-auto rounded-md bg-subtle p-3 text-xs">
                          {prettyDetails(entry.before) ?? "—"}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-muted">
                          After
                        </p>
                        <pre className="mt-1 overflow-x-auto rounded-md bg-subtle p-3 text-xs">
                          {prettyDetails(entry.after) ?? "—"}
                        </pre>
                      </div>
                    </div>
                    {details ? (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-ink-muted">
                          Details
                        </p>
                        <pre className="mt-1 overflow-x-auto rounded-md bg-subtle p-3 text-xs">
                          {details}
                        </pre>
                      </div>
                    ) : null}
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
