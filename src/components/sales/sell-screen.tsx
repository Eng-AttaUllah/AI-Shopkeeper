"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import type { SaleActionState } from "@/app/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPaisa } from "@/lib/format";
import { multiplyPaisa, paisaToRupees, rupeesToPaisa } from "@/lib/money";
import { formatQuantity, fromMilli, toMilli } from "@/lib/quantity";
import type { SellableProduct } from "@/modules/products/queries";

type CartLine = {
  productId: string;
  name: string;
  unit: string;
  unitPricePaisa: number;
  stockMilli: number;
  quantity: string;
};

type SellScreenProps = {
  products: SellableProduct[];
  action: (state: SaleActionState, formData: FormData) => Promise<SaleActionState>;
};

function parseQuantityMilli(value: string): number | null {
  try {
    const milli = toMilli(value);
    return milli > 0 ? milli : null;
  } catch {
    return null;
  }
}

function parsePaisa(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  try {
    return rupeesToPaisa(value);
  } catch {
    return null;
  }
}

export function SellScreen({ products, action }: SellScreenProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const router = useRouter();

  const error = state.ok ? undefined : state.error;
  const fieldErrors = (state.ok ? {} : state.fieldErrors) ?? {};

  // A failed sale usually means stock changed underneath the cart. Refresh the
  // product list so the next attempt sees the real quantities.
  useEffect(() => {
    if (!state.ok && state.error) {
      router.refresh();
    }
  }, [state, router]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.category?.toLowerCase().includes(term) ||
        product.aliases.some((alias) => alias.toLowerCase().includes(term)),
    );
  }, [products, search]);

  const subtotalPaisa = cart.reduce((total, line) => {
    const milli = parseQuantityMilli(line.quantity);

    if (milli === null) {
      return total;
    }

    return total + multiplyPaisa(line.unitPricePaisa, fromMilli(milli));
  }, 0);

  const discountPaisa = parsePaisa(discount) ?? 0;
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);
  const paidPaisa = parsePaisa(paid);
  const changePaisa = paidPaisa === null ? null : paidPaisa - totalPaisa;
  const hasInvalidLine = cart.some(
    (line) => parseQuantityMilli(line.quantity) === null,
  );
  const canSubmit = cart.length > 0 && !hasInvalidLine && !pending;

  function addProduct(product: SellableProduct) {
    if (product.stockMilli <= 0) {
      return;
    }

    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);

      if (existing) {
        const milli = parseQuantityMilli(existing.quantity) ?? 0;
        const nextMilli = Math.min(milli + 1000, product.stockMilli);

        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: String(fromMilli(nextMilli)) }
            : line,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          unitPricePaisa: product.salePricePaisa,
          stockMilli: product.stockMilli,
          quantity: "1",
        },
      ];
    });
  }

  function setQuantity(productId: string, quantity: string) {
    setCart((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, quantity } : line,
      ),
    );
  }

  function stepQuantity(productId: string, direction: 1 | -1) {
    setCart((current) =>
      current.map((line) => {
        if (line.productId !== productId) {
          return line;
        }

        const milli = parseQuantityMilli(line.quantity) ?? 0;
        const nextMilli = Math.min(
          milli + direction * 1000,
          line.stockMilli,
        );

        if (nextMilli <= 0) {
          return line;
        }

        return { ...line, quantity: String(fromMilli(nextMilli)) };
      }),
    );
  }

  function removeLine(productId: string) {
    setCart((current) =>
      current.filter((line) => line.productId !== productId),
    );
  }

  const payload = JSON.stringify({
    items: cart.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    })),
    discount: discount.trim() || "0",
    paid: paid.trim() || undefined,
    paymentMethod: "CASH",
  });

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-3">
        <Label htmlFor="product-search" className="sr-only">
          Search products
        </Label>
        <Input
          id="product-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, category, or other name"
          autoComplete="off"
          className="h-11 text-base"
        />

        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
            <p className="font-medium">No products to sell yet.</p>
            <p className="mt-1 text-sm text-ink-muted">
              Add products with stock before recording a sale.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-ink-muted">
            No product matches “{search}”.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredProducts.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => addProduct(product)}
                  disabled={product.stockMilli <= 0}
                  className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-sm text-ink-muted">
                    {formatPaisa(product.salePricePaisa)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {product.stockMilli <= 0
                      ? "Out of stock"
                      : `${formatQuantity(product.stockMilli, product.unit)} left`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Cart</h2>
          {cart.length > 0 ? (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-sm text-ink-muted transition-colors hover:text-error"
            >
              Clear
            </button>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
          >
            {error}
          </p>
        ) : null}

        {fieldErrors.items ? (
          <p className="text-sm text-error">{fieldErrors.items}</p>
        ) : null}

        {cart.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Tap a product to add it to the sale.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {cart.map((line) => {
              const milli = parseQuantityMilli(line.quantity);
              const lineTotalPaisa =
                milli === null
                  ? null
                  : multiplyPaisa(line.unitPricePaisa, fromMilli(milli));

              return (
                <li key={line.productId} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{line.name}</p>
                      <p className="text-sm text-ink-muted">
                        {formatPaisa(line.unitPricePaisa)} each ·{" "}
                        {formatQuantity(line.stockMilli, line.unit)} available
                      </p>
                    </div>
                    <p className="tabular-nums">
                      {lineTotalPaisa === null
                        ? "—"
                        : formatPaisa(lineTotalPaisa)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="size-11 text-base"
                      onClick={() => stepQuantity(line.productId, -1)}
                      aria-label={`Less ${line.name}`}
                    >
                      −
                    </Button>
                    <Input
                      value={line.quantity}
                      onChange={(event) =>
                        setQuantity(line.productId, event.target.value)
                      }
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Quantity of ${line.name}`}
                      aria-invalid={milli === null}
                      className="h-11 w-20 text-center text-base"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="size-11 text-base"
                      onClick={() => stepQuantity(line.productId, 1)}
                      aria-label={`More ${line.name}`}
                    >
                      +
                    </Button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="ml-auto text-sm text-ink-muted transition-colors hover:text-error"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="discount">Discount (Rs.)</Label>
          <Input
            id="discount"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-invalid={Boolean(fieldErrors.discount)}
            className="h-11 text-base"
          />
          {fieldErrors.discount ? (
            <p className="text-sm text-error">{fieldErrors.discount}</p>
          ) : null}
        </div>

        <dl className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatPaisa(subtotalPaisa)}</dd>
          </div>
          {discountPaisa > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Discount</dt>
              <dd className="tabular-nums">
                − {formatPaisa(discountPaisa)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPaisa(totalPaisa)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <Label htmlFor="paid">Cash received (Rs.)</Label>
          <Input
            id="paid"
            value={paid}
            onChange={(event) => setPaid(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder={String(paisaToRupees(totalPaisa))}
            aria-invalid={Boolean(fieldErrors.paid)}
            className="h-11 text-base"
          />
          <p className="text-sm text-ink-muted">
            Leave empty when the customer pays the exact total.
          </p>
          {fieldErrors.paid ? (
            <p className="text-sm text-error">{fieldErrors.paid}</p>
          ) : null}
          {changePaisa !== null ? (
            <p
              className={
                changePaisa < 0
                  ? "text-sm font-medium text-error"
                  : "text-sm text-ink-muted"
              }
            >
              {changePaisa < 0
                ? `Short by ${formatPaisa(Math.abs(changePaisa))}`
                : `Change ${formatPaisa(changePaisa)}`}
            </p>
          ) : null}
        </div>

        <div className="hidden lg:block">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full text-base"
          >
            {pending
              ? "Saving…"
              : `Complete sale · ${formatPaisa(totalPaisa)}`}
          </Button>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-ink-muted">Total</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatPaisa(totalPaisa)}
            </p>
          </div>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-12 px-5 text-base"
          >
            {pending ? "Saving…" : "Complete sale"}
          </Button>
        </div>
      </div>
    </form>
  );
}
