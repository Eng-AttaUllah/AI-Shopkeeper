import Link from "next/link";

import { createProductAction } from "@/app/products/actions";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/products"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add product</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter the buying price, selling price, and how much you have now.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <ProductForm
          action={createProductAction}
          submitLabel="Save product"
          showOpeningStock
        />
      </section>
    </main>
  );
}
