import Link from "next/link";
import { notFound } from "next/navigation";

import {
  adjustStockAction,
  toggleProductActiveAction,
  updateProductAction,
} from "@/app/products/actions";
import { ProductForm } from "@/components/products/product-form";
import { StockAdjustForm } from "@/components/products/stock-adjust-form";
import { Button } from "@/components/ui/button";
import { formatDate, formatPaisa } from "@/lib/format";
import { paisaToRupees } from "@/lib/money";
import { formatQuantity, fromMilli } from "@/lib/quantity";
import { getProduct } from "@/modules/products/queries";

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<string, string> = {
  OPENING: "Opening stock",
  RESTOCK: "New stock",
  DAMAGE: "Damaged or lost",
  CORRECTION: "Counting correction",
  OTHER: "Other",
};

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const isLow = product.stockMilli <= product.lowStockMilli;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/products"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{product.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {product.category ?? "Uncategorised"} ·{" "}
          {product.isActive ? "On sale" : "Not on sale"}
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Details</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Changing prices affects future sales only. Past sales keep the price
          they were sold at.
        </p>
        <div className="mt-5">
          <ProductForm
            action={updateProductAction}
            submitLabel="Save changes"
            values={{
              id: product.id,
              name: product.name,
              category: product.category,
              unit: product.unit,
              costPrice: String(paisaToRupees(product.costPricePaisa)),
              salePrice: String(paisaToRupees(product.salePricePaisa)),
              lowStockLevel: String(fromMilli(product.lowStockMilli)),
              barcode: product.barcode,
              aliases: product.aliases.map((alias) => alias.alias).join(", "),
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Stock</h2>
          <p className="text-sm text-ink-muted">
            Low-stock level:{" "}
            {formatQuantity(product.lowStockMilli, product.unit)}
          </p>
        </div>

        <p className="mt-3 text-2xl font-semibold tabular-nums">
          {formatQuantity(product.stockMilli, product.unit)}
        </p>
        {isLow ? (
          <p className="mt-1 text-sm text-warning">
            This product is at or below its low-stock level.
          </p>
        ) : null}

        <div className="mt-5">
          <StockAdjustForm
            action={adjustStockAction}
            productId={product.id}
            unit={product.unit}
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Recent stock changes</h2>

        {product.stockMovements.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No stock changes yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {product.stockMovements.map((movement) => (
              <li
                key={movement.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {REASON_LABELS[movement.reason] ?? movement.reason}
                  </p>
                  <p className="text-ink-muted">
                    {formatDate(movement.createdAt)}
                    {movement.note ? ` · ${movement.note}` : ""}
                  </p>
                </div>
                <span className="tabular-nums">
                  {movement.quantityMilli > 0 ? "+" : ""}
                  {formatQuantity(movement.quantityMilli, product.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Availability</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Stopping a product hides it from the sale screen. Its history is kept.
        </p>
        <form action={toggleProductActiveAction} className="mt-4">
          <input type="hidden" name="productId" value={product.id} />
          <input
            type="hidden"
            name="isActive"
            value={product.isActive ? "false" : "true"}
          />
          <Button
            type="submit"
            variant="outline"
            className="h-11 px-4 text-base"
          >
            {product.isActive ? "Stop selling" : "Start selling again"}
          </Button>
        </form>
      </section>

      <p className="text-sm text-ink-muted">
        Cost price: {formatPaisa(product.costPricePaisa)} · Sale price:{" "}
        {formatPaisa(product.salePricePaisa)}
      </p>
    </main>
  );
}
