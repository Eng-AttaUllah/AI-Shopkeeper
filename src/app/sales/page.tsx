import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { listSales } from "@/modules/sales/queries";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const sales = await listSales(50);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales</h1>
          <p className="mt-1 text-sm text-ink-muted">
            The last 50 sales, newest first.
          </p>
        </div>
        <Link
          href="/sell"
          className={buttonVariants({ className: "h-11 px-4 text-base" })}
        >
          New sale
        </Link>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">No sales yet.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Record your first sale and it will appear here with its receipt.
          </p>
          <Link
            href="/sell"
            className={buttonVariants({
              className: "mt-4 h-11 px-4 text-base",
            })}
          >
            Start a sale
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <span className="font-medium">{sale.number}</span>
                      {sale.voidedAt ? (
                        <Badge variant="destructive" className="ml-2">
                          Voided
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {sale.customer ? (
                        <Link
                          href={`/customers/${sale.customer.id}`}
                          className="font-medium text-brand hover:text-brand-hover"
                        >
                          {sale.customer.name}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">Cash</span>
                      )}
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {formatDateTime(sale.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {sale._count.items}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPaisa(sale.totalPaisa)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/sales/${sale.id}`}
                        className="text-sm font-medium text-brand hover:text-brand-hover"
                      >
                        Receipt
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{sale.number}</p>
                    {sale.customer ? (
                      <p className="text-sm font-medium text-brand">
                        {sale.customer.name}
                      </p>
                    ) : null}
                    <p className="text-sm text-ink-muted">
                      {formatDateTime(sale.createdAt)}
                    </p>
                  </div>
                  {sale.voidedAt ? (
                    <Badge variant="destructive">Voided</Badge>
                  ) : sale.paymentMethod === "CREDIT" ? (
                    <Badge variant="secondary">Credit</Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-ink-muted">
                    {sale._count.items}{" "}
                    {sale._count.items === 1 ? "item" : "items"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatPaisa(sale.totalPaisa)}
                  </span>
                </div>
                <Link
                  href={`/sales/${sale.id}`}
                  className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-hover"
                >
                  View receipt
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
