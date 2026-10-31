import Link from "next/link";
import { notFound } from "next/navigation";

import { recordPaymentAction } from "@/app/customers/actions";
import { PaymentForm } from "@/components/customers/payment-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { t } from "@/lib/i18n";
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

  const saleLabel = await t("dashboard.sale");
  const itemLabel = await t("customers.item");
  const itemsLabel = await t("customers.items");
  const paymentLabel = await t("customers.payment");
  const cashPaymentLabel = await t("customers.cashPayment");
  const paidLabel = await t("customers.paid");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href="/customers"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {await t("customers.backToCustomers")}
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{customer.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {customer.phone ?? (await t("customers.noPhoneNumber"))}
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
              {await t("action.edit")}
            </Link>
            <Link
              href="/sell"
              className={buttonVariants({ className: "h-11 px-4 text-base" })}
            >
              {t("action.newSale")}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">
                  {await t("customers.outstandingBalance")}
                </p>
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
              {await t("customers.balanceCalculated")}
            </p>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">{await t("customers.history")}</h2>

            {history.length === 0 ? (
              <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
                {await t("customers.noCreditSalesOrPayments")}
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
                              {saleLabel} {entry.number}
                            </Link>
                          </p>
                          <p className="text-sm text-ink-muted">
                            {formatDateTime(entry.createdAt)} ·{" "}
                            {entry.itemCount}{" "}
                            {entry.itemCount === 1 ? itemLabel : itemsLabel}{" "}
                            {entry.paidPaisa > 0
                              ? ` · ${formatPaisa(entry.paidPaisa)} ${paidLabel}`
                              : ""}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">
                            {paymentLabel}
                          </p>
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
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">
              {await t("customers.recordPayment")}
            </h2>

            {balancePaisa > 0 ? (
              <>
                <p className="mt-1 mb-4 text-sm text-ink-muted">
                  {await t("customers.paymentCannotExceed")}
                </p>
                <PaymentForm
                  customerId={customer.id}
                  action={recordPaymentAction}
                />
              </>
            ) : (
              <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
                {await t("customers.nothingOutstanding")}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">{await t("customers.statement")}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {await t("customers.sendStatement")}
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
              {await t("customers.sendOnWhatsApp")}
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
