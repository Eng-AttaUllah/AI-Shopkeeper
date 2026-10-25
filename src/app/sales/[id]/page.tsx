import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import { getSale, saleSubtotalPaisa } from "@/modules/sales/queries";

export const dynamic = "force-dynamic";

type SaleReceiptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SaleReceiptPage({
  params,
}: SaleReceiptPageProps) {
  const { id } = await params;
  const sale = await getSale(id);

  if (!sale) {
    notFound();
  }

  const subtotalPaisa = saleSubtotalPaisa(sale);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            Receipt
          </p>
          <h1 className="mt-1 text-2xl font-semibold tabular-nums">
            {sale.number}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDateTime(sale.createdAt)}
          </p>
        </div>
        <Badge variant="secondary">
          {sale.paymentMethod === "CASH" ? "Cash" : "Credit"}
        </Badge>
      </div>

      {sale.voidedAt ? (
        <p className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          This sale was voided on {formatDateTime(sale.voidedAt)}
          {sale.voidedReason ? `: ${sale.voidedReason}` : "."}
        </p>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-5">
        <ul className="divide-y divide-line">
          {sale.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-sm text-ink-muted">
                  {formatQuantity(item.quantityMilli, item.unit)} ×{" "}
                  {formatPaisa(item.unitPricePaisa)}
                </p>
              </div>
              <p className="tabular-nums">{formatPaisa(item.lineTotalPaisa)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 flex flex-col gap-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatPaisa(subtotalPaisa)}</dd>
          </div>
          {sale.discountPaisa > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Discount</dt>
              <dd className="tabular-nums">
                − {formatPaisa(sale.discountPaisa)}
              </dd>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between border-t border-line pt-3 text-lg font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPaisa(sale.totalPaisa)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Cash received</dt>
            <dd className="tabular-nums">{formatPaisa(sale.paidPaisa)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Change</dt>
            <dd className="tabular-nums">{formatPaisa(sale.changePaisa)}</dd>
          </div>
        </dl>

        {sale.note ? (
          <p className="mt-4 rounded-md bg-subtle px-3 py-2 text-sm">
            {sale.note}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/sell"
          className={buttonVariants({ className: "h-11 px-4 text-base" })}
        >
          New sale
        </Link>
        <Link
          href="/sales"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 px-4 text-base",
          })}
        >
          All sales
        </Link>
      </div>
    </main>
  );
}
