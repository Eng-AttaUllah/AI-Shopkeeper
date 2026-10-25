import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPaisa } from "@/lib/format";
import {
  listCustomersWithBalances,
  totalOutstandingPaisa,
} from "@/modules/customers/queries";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const [customers, totalOutstanding] = await Promise.all([
    listCustomersWithBalances(search),
    totalOutstandingPaisa(),
  ]);

  const owing = customers.filter((customer) => customer.balancePaisa > 0).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Khata balances and repayments.
          </p>
        </div>
        <Link
          href="/customers/new"
          className={buttonVariants({ className: "h-11 px-4 text-base" })}
        >
          Add customer
        </Link>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm text-ink-muted">Customers</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {customers.length}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm text-ink-muted">Owing</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {owing}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm text-ink-muted">Total outstanding</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatPaisa(totalOutstanding)}
          </dd>
        </div>
      </dl>

      <form action="/customers" className="flex gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="Search by name or phone"
          autoComplete="off"
          className="h-11 max-w-sm text-base"
        />
        <button
          type="submit"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 px-4 text-base",
          })}
        >
          Search
        </button>
        {search ? (
          <Link
            href="/customers"
            className={buttonVariants({
              variant: "ghost",
              className: "h-11 px-3 text-base",
            })}
          >
            Clear
          </Link>
        ) : null}
      </form>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">
            {search ? `No customer matches “${search}”.` : "No customers yet."}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {search
              ? "Try another name or phone number."
              : "Add a customer before giving credit on a sale."}
          </p>
          {search ? null : (
            <Link
              href="/customers/new"
              className={buttonVariants({
                className: "mt-4 h-11 px-4 text-base",
              })}
            >
              Add customer
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <span className="font-medium">{customer.name}</span>
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {customer.phone ?? "—"}
                    </TableCell>
                    <TableCell
                      className={
                        customer.balancePaisa > 0
                          ? "font-medium tabular-nums text-error"
                          : "tabular-nums text-ink-muted"
                      }
                    >
                      {formatPaisa(customer.balancePaisa)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-sm font-medium text-brand hover:text-brand-hover"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {customers.map((customer) => (
              <li
                key={customer.id}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-ink-muted">
                      {customer.phone ?? "No phone"}
                    </p>
                  </div>
                  <p
                    className={
                      customer.balancePaisa > 0
                        ? "font-semibold tabular-nums text-error"
                        : "tabular-nums text-ink-muted"
                    }
                  >
                    {formatPaisa(customer.balancePaisa)}
                  </p>
                </div>
                <Link
                  href={`/customers/${customer.id}`}
                  className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-hover"
                >
                  Open khata
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
