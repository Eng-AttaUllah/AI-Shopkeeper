import Link from "next/link";

import { createProductAction } from "@/app/products/actions";
import { ProductForm } from "@/components/products/product-form";
import { readClientLocale, translate } from "@/lib/dictionary";

export default function NewProductPage() {
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/products"
          className="text-sm text-ink-muted hover:text-ink"
        >
          {t("products.backToProducts")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {t("products.addProductHeading")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("products.addProductDesc")}
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <ProductForm
          action={createProductAction}
          submitLabel={t("products.saveProduct")}
          showOpeningStock
        />
      </section>
    </main>
  );
}
