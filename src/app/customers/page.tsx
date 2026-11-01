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
import { readClientLocale, translate } from "@/lib/dictionary";
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

  const owing = customers.filter(
    (customer) => customer.balancePaisa > 0,
  ).length;

  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{await t("page.customers")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("customers.khataBalances")}
          </p>
        </div>
        <Link
          href="/customers/new"
          className={buttonVariants({ className: "h-11 px-4 text-base" })}
        >
          {t("customers.addCustomer")}
        </Link>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm text-ink-muted">{await t("page.customers")}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {customers.length}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm text-ink-muted">{t("customers.owing")}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {owing}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm text-ink-muted">
            {t("customers.totalOutstanding")}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatPaisa(totalOutstanding)}
          </dd>
        </div>
      </dl>

      <form action="/customers" className="flex gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder={t("customers.searchPlaceholder")}
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
          {t("action.search")}
        </button>
        {search ? (
          <Link
            href="/customers"
            className={buttonVariants({
              variant: "ghost",
              className: "h-11 px-3 text-base",
            })}
          >
            {t("action.clearSearch")}
          </Link>
        ) : null}
      </form>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">
            {search
              ? t("customers.noCustomerMatches", { search })
              : t("customers.noCustomersYet")}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {search
              ? t("customers.tryAnotherName")
              : t("customers.addCustomerBeforeCredit")}
          </p>
          {search ? null : (
            <Link
              href="/customers/new"
              className={buttonVariants({
                className: "mt-4 h-11 px-4 text-base",
              })}
            >
              {t("customers.addCustomer")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{await t("page.customers")}</TableHead>
                  <TableHead>{t("customerForm.phoneOptional")}</TableHead>
                  <TableHead>{t("customers.outstandingBalance")}</TableHead>
                  <TableHead className="text-right">{t("products.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <span className="font-medium">{customer.name}</span>
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {customer.phone ?? t("customers.noPhone")}
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
                        {t("action.view")}
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
                      {customer.phone ?? t("customers.noPhone")}
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
                  {t("customers.openKhata")}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
