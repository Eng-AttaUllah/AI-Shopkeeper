import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
import { formatQuantity } from "@/lib/quantity";
import { readClientLocale, translate } from "@/lib/dictionary";
import {
  inventoryValuePaisa,
  listProducts,
  lowStockProducts,
} from "@/modules/products/queries";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { q } = await searchParams;

  const [products, lowStock, inventoryValue] = await Promise.all([
    listProducts({ search: q }),
    lowStockProducts(),
    inventoryValuePaisa(),
  ]);

  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{await t("page.products")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Items you buy and sell, with prices and current stock.
          </p>
        </div>
        <Link
          href="/products/new"
          className={buttonVariants({ className: "h-11 px-4 text-base" })}
        >
          {t("action.addProduct")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("page.products")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {products.length}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("products.lowStockLevel")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-warning">
            {lowStock.length}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("products.stockValueCost")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatPaisa(inventoryValue)}
          </p>
        </div>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("sell.searchPlaceholder")}
          className="h-11 text-base"
        />
        <button
          type="submit"
          className={buttonVariants({
            variant: "secondary",
            className: "h-11 px-4 text-base",
          })}
        >
          {t("action.search")}
        </button>
      </form>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">
            {q ? t("sell.noProductMatches", { search: q }) : t("products.noProductsYet")}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {q
              ? t("products.tryDifferentWord")
              : t("products.addYourFirstProduct")}
          </p>
          {q ? (
            <Link
              href="/products"
              className={buttonVariants({
                variant: "secondary",
                className: "mt-4 h-11 px-4 text-base",
              })}
            >
              {t("action.clearSearch")}
            </Link>
          ) : (
            <Link
              href="/products/new"
              className={buttonVariants({
                className: "mt-4 h-11 px-4 text-base",
              })}
            >
              {t("action.addProduct")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("products.productName")}</TableHead>
                  <TableHead>{t("proposal.costPrice")}</TableHead>
                  <TableHead>{t("proposal.salePrice")}</TableHead>
                  <TableHead>{t("products.stock")}</TableHead>
                  <TableHead className="text-right">{t("products.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const isLow = product.stockMilli <= product.lowStockMilli;

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-ink-muted">
                          {product.category ?? t("products.uncategorised")}
                        </p>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatPaisa(product.costPricePaisa)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatPaisa(product.salePricePaisa)}
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums">
                          {formatQuantity(product.stockMilli, product.unit)}
                        </span>
                        {isLow ? (
                          <Badge variant="destructive" className="ml-2">
                            Low
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/products/${product.id}/edit`}
                          className="text-sm font-medium text-brand hover:text-brand-hover"
                        >
                          {t("products.edit")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {products.map((product) => {
              const isLow = product.stockMilli <= product.lowStockMilli;

              return (
                <li
                  key={product.id}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-ink-muted">
                        {product.category ?? t("products.uncategorised")}
                      </p>
                    </div>
                    {isLow ? <Badge variant="destructive">Low</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="tabular-nums text-ink-muted">
                      {t("products.saleShort")} {formatPaisa(product.salePricePaisa)}
                    </span>
                    <span className="tabular-nums">
                      {formatQuantity(product.stockMilli, product.unit)}
                    </span>
                  </div>
                  <Link
                    href={`/products/${product.id}/edit`}
                    className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    {t("products.editProduct")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
