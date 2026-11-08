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
import { readClientLocale, translate } from "@/lib/dictionary";
import { requireShopkeeper } from "@/lib/require-user";
import { listSales } from "@/modules/sales/queries";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const { shop } = await requireShopkeeper();
  const sales = await listSales(shop.id, 50);
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{await t("page.sales")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("sales.last50Sales")}
          </p>
        </div>
        <Link
          href="/sell"
          className={buttonVariants({ className: "h-11 px-4 text-base" })}
        >
          {t("sales.newSale")}
        </Link>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">{t("sales.noSales")}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {t("sales.recordFirstSale")}
          </p>
          <Link
            href="/sell"
            className={buttonVariants({
              className: "mt-4 h-11 px-4 text-base",
            })}
          >
            {t("sales.startSale")}
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.receipt")}</TableHead>
                  <TableHead>{t("sales.customer")}</TableHead>
                  <TableHead>{t("sales.when")}</TableHead>
                  <TableHead>{t("sales.items")}</TableHead>
                  <TableHead>{t("sales.total")}</TableHead>
                  <TableHead className="text-right">{t("sales.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <span className="font-medium">{sale.number}</span>
                      {sale.voidedAt ? (
                        <Badge variant="destructive" className="ml-2">
                          {t("sales.voided")}
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
                        <span className="text-ink-muted">{t("sales.cash")}</span>
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
                        {t("sales.viewReceipt")}
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
                    <Badge variant="destructive">{t("sales.voided")}</Badge>
                  ) : sale.paymentMethod === "CREDIT" ? (
                    <Badge variant="secondary">{t("sales.credit")}</Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-ink-muted">
                    {sale._count.items}{" "}
                    {sale._count.items === 1 ? t("sales.item") : t("sales.itemsCount")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatPaisa(sale.totalPaisa)}
                  </span>
                </div>
                <Link
                  href={`/sales/${sale.id}`}
                  className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-hover"
                >
                  {t("sales.viewReceipt")}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
