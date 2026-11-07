"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import type { SaleActionState } from "@/app/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPaisa } from "@/lib/format";
import { multiplyPaisa, paisaToRupees, rupeesToPaisa } from "@/lib/money";
import { formatQuantity, fromMilli, toMilli } from "@/lib/quantity";
import { readClientLocale, translate } from "@/lib/dictionary";
import { normalizeText } from "@/lib/text";
import type { CustomerOption } from "@/modules/customers/queries";
import type { SellableProduct } from "@/modules/products/queries";

type CartLine = {
  productId: string;
  name: string;
  unit: string;
  unitPricePaisa: number;
  stockMilli: number;
  quantity: string;
};

type PaymentMethod = "CASH" | "CREDIT";

type SellScreenProps = {
  products: SellableProduct[];
  customers: CustomerOption[];
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

export function SellScreen({ products, customers, action }: SellScreenProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [customerId, setCustomerId] = useState("");
  const router = useRouter();
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const error = state.ok ? undefined : state.error;
  const fieldErrors = (state.ok ? {} : state.fieldErrors) ?? {};

  // A failed sale usually means stock changed underneath the cart. Refresh the
  // product list so the next attempt sees the real quantities.
  useEffect(() => {
    if (!state.ok && state.error) {
      router.refresh();
    }
  }, [state, router]);

  // The "New customer" link opens a separate tab so the cart is kept. When the
  // shopkeeper comes back, re-fetch the server data so the new customer appears
  // in the select without a manual reload.
  useEffect(() => {
    function refreshOnReturn() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [router]);

  const filteredProducts = useMemo(() => {
    const term = normalizeText(search);

    if (!term) {
      return products;
    }

    return products.filter(
      (product) =>
        normalizeText(product.name).includes(term) ||
        normalizeText(product.category ?? "").includes(term) ||
        product.aliases.some((alias) => normalizeText(alias).includes(term)),
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
  const isCredit = paymentMethod === "CREDIT";
  const changePaisa = paidPaisa === null ? null : paidPaisa - totalPaisa;
  const creditDuePaisa =
    paidPaisa === null ? totalPaisa : Math.max(0, totalPaisa - paidPaisa);
  const overpaidOnCredit =
    isCredit && paidPaisa !== null && paidPaisa > totalPaisa;
  const hasInvalidLine = cart.some(
    (line) => parseQuantityMilli(line.quantity) === null,
  );
  const canSubmit =
    cart.length > 0 &&
    !hasInvalidLine &&
    !pending &&
    (!isCredit || (Boolean(customerId) && !overpaidOnCredit));

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
    paymentMethod,
    customerId: isCredit ? customerId || undefined : undefined,
  });

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-3">
        <Label htmlFor="product-search" className="sr-only">
          {t("sell.searchProducts")}
        </Label>
        <Input
          id="product-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("sell.searchPlaceholder")}
          autoComplete="off"
          className="h-11 text-base"
          dir="auto"
        />

        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
            <p className="font-medium">{t("sell.noProductsToSell")}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {t("sell.addProductsBeforeSale")}
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-ink-muted">
            {t("sell.noProductMatches", { search })}
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
                      ? t("sell.outOfStock")
                      : `${formatQuantity(
                          product.stockMilli,
                          product.unit,
                        )} ${t("sell.available")}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("sell.cart")}</h2>
          {cart.length > 0 ? (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-sm text-ink-muted transition-colors hover:text-error"
            >
              {t("sell.clear")}
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
          <p className="text-sm text-ink-muted">{t("sell.tapProduct")}</p>
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
                        {formatQuantity(line.stockMilli, line.unit)}{" "}
                        {t("sell.available")}
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
                      aria-label={t("sell.less", { name: line.name })}
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
                      aria-label={t("sell.quantityOf", { name: line.name })}
                      aria-invalid={milli === null}
                      className="h-11 w-20 text-center text-base"
                      dir="ltr"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="size-11 text-base"
                      onClick={() => stepQuantity(line.productId, 1)}
                      aria-label={t("sell.more", { name: line.name })}
                    >
                      +
                    </Button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="ml-auto text-sm text-ink-muted transition-colors hover:text-error"
                    >
                      {t("sell.remove")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="discount">{t("sell.discount")}</Label>
          <Input
            id="discount"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-invalid={Boolean(fieldErrors.discount)}
            className="h-11 text-base"
            dir="ltr"
          />
          {fieldErrors.discount ? (
            <p className="text-sm text-error">{fieldErrors.discount}</p>
          ) : null}
        </div>

        <dl className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">{t("sell.subtotal")}</dt>
            <dd className="tabular-nums">{formatPaisa(subtotalPaisa)}</dd>
          </div>
          {discountPaisa > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t("sell.discount")}</dt>
              <dd className="tabular-nums">
                − {formatPaisa(discountPaisa)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <dt>{t("sell.total")}</dt>
            <dd className="tabular-nums">{formatPaisa(totalPaisa)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <Label>{t("sell.paymentMethod")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentMethod("CASH");
                setPaid("");
              }}
              aria-pressed={!isCredit}
              className={`h-11 rounded-lg border text-base font-medium transition-colors ${
                isCredit
                  ? "border-line bg-surface text-ink hover:bg-subtle"
                  : "border-brand bg-brand-soft font-semibold text-brand"
              }`}
            >
              {t("sell.cash")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentMethod("CREDIT");
                setPaid("");
              }}
              aria-pressed={isCredit}
              className={`h-11 rounded-lg border text-base font-medium transition-colors ${
                isCredit
                  ? "border-brand bg-brand-soft font-semibold text-brand"
                  : "border-line bg-surface text-ink hover:bg-subtle"
              }`}
            >
              {t("sell.creditKhata")}
            </button>
          </div>
        </div>

        {isCredit ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="customer">{t("proposal.customer")}</Label>
              <Link
                href="/customers/new"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-brand hover:text-brand-hover"
              >
                {t("sell.newCustomer")}
              </Link>
            </div>
            <select
              id="customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
              aria-invalid={Boolean(fieldErrors.customerId)}
            >
              <option value="">{t("sell.chooseCustomer")}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.balancePaisa > 0
                    ? ` (owes ${formatPaisa(customer.balancePaisa)})`
                    : ""}
                </option>
              ))}
            </select>
            {customers.length === 0 ? (
              <p className="text-xs text-ink-muted">
                {t("sell.noCustomersYet")}{" "}
                <Link
                  href="/customers/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  {t("sell.createCustomerFirst")}
                </Link>{" "}
                first.
              </p>
            ) : null}
            {fieldErrors.customerId ? (
              <p className="text-sm text-error">{fieldErrors.customerId}</p>
            ) : null}
          </div>
        ) : null}

        {isCredit ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="paid">{t("sell.cashReceivedNow")}</Label>
            <Input
              id="paid"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              aria-invalid={Boolean(fieldErrors.paid) || overpaidOnCredit}
              className="h-11 text-base"
              dir="ltr"
            />
            <p className="text-sm text-ink-muted">
              {t("sell.leaveEmptyCredit")}
            </p>
            {fieldErrors.paid ? (
              <p className="text-sm text-error">{fieldErrors.paid}</p>
            ) : null}
            {overpaidOnCredit ? (
              <p className="text-sm text-error">
                {t("sell.cannotReceiveMore")}
              </p>
            ) : (
              <div className="rounded-lg bg-subtle p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">{t("sell.addedToKhata")}</span>
                  <span className="font-semibold tabular-nums text-error">
                    {formatPaisa(creditDuePaisa)}
                  </span>
                </div>
                {paidPaisa !== null && paidPaisa > 0 ? (
                  <div className="mt-1 flex justify-between text-xs text-ink-muted">
                    <span>{t("sell.paidNow")}</span>
                    <span className="tabular-nums">
                      {formatPaisa(paidPaisa)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="paid">{t("sell.cashReceived")}</Label>
            <Input
              id="paid"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder={String(paisaToRupees(totalPaisa))}
              aria-invalid={Boolean(fieldErrors.paid)}
              className="h-11 text-base"
              dir="ltr"
            />
            <p className="text-sm text-ink-muted">
              {t("sell.leaveEmptyExact")}
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
                  ? t("sell.shortBy", { amount: formatPaisa(Math.abs(changePaisa)) })
                  : t("sell.change", { amount: formatPaisa(changePaisa) })}
              </p>
            ) : null}
          </div>
        )}

        <div className="hidden lg:block">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full bg-money! text-base text-white! hover:bg-money-hover!"
          >
            {pending
              ? "Saving…"
              : isCredit
                ? t("sell.recordCreditSale", {
                    amount: formatPaisa(creditDuePaisa),
                  })
                : t("sell.completeSale", {
                    amount: formatPaisa(totalPaisa),
                  })}
          </Button>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-ink-muted">
              {isCredit ? t("sell.onKhata") : t("sell.total")}
            </p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                isCredit ? "text-error" : "text-money"
              }`}
            >
              {formatPaisa(isCredit ? creditDuePaisa : totalPaisa)}
            </p>
          </div>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-12 bg-money! px-5 text-base text-white! hover:bg-money-hover!"
          >
            {pending
              ? "Saving…"
              : isCredit
                ? t("sell.recordCredit")
                : t("sell.completeSaleShort")}
          </Button>
        </div>
      </div>
    </form>
  );
}
