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
import { t } from "@/lib/i18n";
import { getProduct } from "@/modules/products/queries";

export const dynamic = "force-dynamic";

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

  const reasonLabels = {
    OPENING: await t("products.openingStockLabel"),
    RESTOCK: await t("products.newStock"),
    DAMAGE: await t("products.damagedOrLost"),
    CORRECTION: await t("products.countingCorrection"),
    OTHER: await t("products.other"),
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/products"
          className="text-sm text-ink-muted hover:text-ink"
        >
          {await t("products.backToProducts")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{product.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {product.category ?? (await t("products.uncategorised"))} ·{" "}
          {product.isActive ? (await t("products.onSale")) : (await t("products.notOnSale"))}
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{await t("products.details")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {await t("products.priceNote")}
        </p>
        <div className="mt-5">
          <ProductForm
            action={updateProductAction}
            submitLabel={await t("products.saveChanges")}
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
          <h2 className="text-lg font-semibold">{await t("products.stock")}</h2>
          <p className="text-sm text-ink-muted">
            {await t("products.lowStockLevel")}:{" "}
            {formatQuantity(product.lowStockMilli, product.unit)}
          </p>
        </div>

        <p className="mt-3 text-2xl font-semibold tabular-nums">
          {formatQuantity(product.stockMilli, product.unit)}
        </p>
        {isLow ? (
          <p className="mt-1 text-sm text-warning">
            {await t("products.atOrBelowLowStock")}
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
        <h2 className="text-lg font-semibold">
          {await t("products.recentStockChanges")}
        </h2>

        {product.stockMovements.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            {await t("products.noStockChangesYet")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {product.stockMovements.map((movement) => (
              <li
                key={movement.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {reasonLabels[movement.reason as keyof typeof reasonLabels] ?? movement.reason}
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
        <h2 className="text-lg font-semibold">{await t("products.availability")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {await t("products.stopHides")}
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
            {product.isActive ? (await t("products.stopSelling")) : (await t("products.startSellingAgain"))}
          </Button>
        </form>
      </section>

      <p className="text-sm text-ink-muted">
        {(await t("proposal.costPrice"))}: {formatPaisa(product.costPricePaisa)} · {(await t("proposal.salePrice"))}:{" "}
        {formatPaisa(product.salePricePaisa)}
      </p>
    </main>
  );
}
