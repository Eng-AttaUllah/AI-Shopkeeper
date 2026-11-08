import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { requireActiveMembership } from "@/lib/require-user";
import { t } from "@/lib/i18n";
import {
  buildStatementText,
  customerBalancePaisa,
  customerHistory,
} from "@/modules/customers/queries";

export const dynamic = "force-dynamic";

export default async function CustomerKhataPage() {
  const { shop, membership } = await requireActiveMembership();
  const customer = membership.customer;

  if (!customer) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
          <p className="text-sm font-semibold text-brand">{await t("app.name")}</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {await t("customerKhata.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {await t("customerKhata.noAccount")}
          </p>
        </div>
      </main>
    );
  }

  const [
    yourKhataLabel,
    refreshLabel,
    outstandingBalanceLabel,
    transactionHistoryLabel,
    noTransactionsLabel,
    totalOutstandingLabel,
  ] = await Promise.all([
    t("customerKhata.yourKhata"),
    t("customerKhata.refresh"),
    t("customerKhata.outstandingBalance"),
    t("customerKhata.transactionHistory"),
    t("customerKhata.noTransactions"),
    t("customerKhata.totalOutstanding"),
  ]);

  const [balancePaisa, history] = await Promise.all([
    customerBalancePaisa(shop.id, customer.id),
    customerHistory(shop.id, customer.id),
  ]);

  const statement = buildStatementText({
    shopName: shop.name,
    customer,
    balancePaisa,
    entries: history,
  });

  const phoneDigits = customer.phone?.replace(/\D/g, "") ?? "";
  const whatsappHref = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(statement)}`;

  const saleLabelLoc = await t("customers.sale");
  const itemLabel = await t("customers.item");
  const itemsLabel = await t("customers.items");
  const paymentLabelLoc = await t("customers.payment");
  const cashPaymentLabel = await t("customers.cashPayment");
  const paidLabel = await t("customers.paid");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">{yourKhataLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/customers/khata"
            className={buttonVariants({ className: "h-11 px-4 text-base" })}
          >
            {refreshLabel}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">{outstandingBalanceLabel}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatPaisa(balancePaisa)}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{transactionHistoryLabel}</h2>

        {history.length === 0 ? (
          <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
            {noTransactionsLabel}
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
                        {saleLabelLoc} {entry.number}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{paymentLabelLoc}</p>
                      <p className="text-sm text-ink-muted">
                        {formatDateTime(entry.createdAt)} ·{" "}
                        {entry.note ?? cashPaymentLabel}
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

      <p className="mt-4 text-sm text-ink-muted text-center">
        {totalOutstandingLabel}:{" "}
        <span className="font-semibold tabular-nums">
          {formatPaisa(balancePaisa)}
        </span>
      </p>
    </main>
  );
}
