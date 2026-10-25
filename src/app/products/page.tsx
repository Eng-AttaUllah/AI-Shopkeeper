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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Items you buy and sell, with prices and current stock.
          </p>
        </div>
        <Link
          href="/products/new"
          className={buttonVariants({ className: "h-11 px-4 text-base" })}
        >
          Add product
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">Products</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {products.length}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">Low stock</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-warning">
            {lowStock.length}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-muted">Stock value (cost)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatPaisa(inventoryValue)}
          </p>
        </div>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, alias, category, or barcode"
          className="h-11 text-base"
        />
        <button
          type="submit"
          className={buttonVariants({
            variant: "secondary",
            className: "h-11 px-4 text-base",
          })}
        >
          Search
        </button>
      </form>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">
            {q ? "No products match your search." : "No products yet."}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {q
              ? "Try a different word, or clear the search."
              : "Add your first product to start tracking stock and prices."}
          </p>
          {q ? (
            <Link
              href="/products"
              className={buttonVariants({
                variant: "secondary",
                className: "mt-4 h-11 px-4 text-base",
              })}
            >
              Clear search
            </Link>
          ) : (
            <Link
              href="/products/new"
              className={buttonVariants({
                className: "mt-4 h-11 px-4 text-base",
              })}
            >
              Add product
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Sale</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          {product.category ?? "Uncategorised"}
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
                          Edit
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
                        {product.category ?? "Uncategorised"}
                      </p>
                    </div>
                    {isLow ? <Badge variant="destructive">Low</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="tabular-nums text-ink-muted">
                      Sale {formatPaisa(product.salePricePaisa)}
                    </span>
                    <span className="tabular-nums">
                      {formatQuantity(product.stockMilli, product.unit)}
                    </span>
                  </div>
                  <Link
                    href={`/products/${product.id}/edit`}
                    className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    Edit product
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
