import Link from "next/link";
import { notFound } from "next/navigation";

import { recordPaymentAction } from "@/app/customers/actions";
import { PaymentForm } from "@/components/customers/payment-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatDateTime, formatPaisa } from "@/lib/format";
import {
  buildStatementText,
  customerBalancePaisa,
  customerHistory,
  getCustomer,
} from "@/modules/customers/queries";

export const dynamic = "force-dynamic";

type CustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: CustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) {
    notFound();
  }

  const [balancePaisa, history, shop] = await Promise.all([
    customerBalancePaisa(id),
    customerHistory(id),
    prisma.shop.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const statement = buildStatementText({
    shopName: shop?.name ?? "Shop",
    customer,
    balancePaisa,
    entries: history,
  });

  const phoneDigits = customer.phone?.replace(/\D/g, "") ?? "";
  const whatsappHref = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(statement)}`;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href="/customers"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          ← Customers
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{customer.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {customer.phone ?? "No phone number"}
            </p>
            {customer.note ? (
              <p className="mt-1 text-sm text-ink-muted">{customer.note}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/customers/${customer.id}/edit`}
              className={buttonVariants({
                variant: "outline",
                className: "h-11 px-4 text-base",
              })}
            >
              Edit
            </Link>
            <Link
              href="/sell"
              className={buttonVariants({ className: "h-11 px-4 text-base" })}
            >
              New sale
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">Outstanding balance</p>
                <p
                  className={
                    balancePaisa > 0
                      ? "mt-1 text-3xl font-semibold tabular-nums text-error"
                      : "mt-1 text-3xl font-semibold tabular-nums"
                  }
                >
                  {formatPaisa(balancePaisa)}
                </p>
              </div>
              <Badge variant={balancePaisa > 0 ? "secondary" : "outline"}>
                {balancePaisa > 0 ? "Owes" : "Settled"}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Credit sales minus recorded payments. It is calculated from the
              sales and payments, never stored separately.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">History</h2>

            {history.length === 0 ? (
              <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
                No credit sales or payments yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {history.map((entry) => (
                  <li
                    key={`${entry.kind}-${entry.id}`}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      {entry.kind === "sale" ? (
                        <>
                          <p className="font-medium">
                            <Link
                              href={`/sales/${entry.id}`}
                              className="hover:text-brand"
                            >
                              Sale {entry.number}
                            </Link>
                          </p>
                          <p className="text-sm text-ink-muted">
                            {formatDateTime(entry.createdAt)} ·{" "}
                            {entry.itemCount}{" "}
                            {entry.itemCount === 1 ? "item" : "items"}
                            {entry.paidPaisa > 0
                              ? ` · ${formatPaisa(entry.paidPaisa)} paid`
                              : ""}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Payment</p>
                          <p className="text-sm text-ink-muted">
                            {formatDateTime(entry.createdAt)} ·{" "}
                            {entry.note ?? "Cash payment"}
                          </p>
                        </>
                      )}
                    </div>

                    <p
                      className={
                        entry.kind === "sale"
                          ? "shrink-0 font-medium tabular-nums text-error"
                          : "shrink-0 font-medium tabular-nums text-success"
                      }
                    >
                      {entry.kind === "sale"
                        ? `+ ${formatPaisa(entry.duePaisa)}`
                        : `− ${formatPaisa(entry.amountPaisa)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">Record a payment</h2>

            {balancePaisa > 0 ? (
              <>
                <p className="mt-1 mb-4 text-sm text-ink-muted">
                  A payment cannot be more than the outstanding balance.
                </p>
                <PaymentForm
                  customerId={customer.id}
                  action={recordPaymentAction}
                />
              </>
            ) : (
              <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
                Nothing is outstanding. Record a credit sale first.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">Statement</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Send this text on WhatsApp or copy it.
            </p>

            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-subtle p-3 text-sm">
              {statement}
            </pre>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({
                variant: "outline",
                className: "mt-3 h-11 w-full px-4 text-base",
              })}
            >
              Send on WhatsApp
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
