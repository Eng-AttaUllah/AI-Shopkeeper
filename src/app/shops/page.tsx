import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readClientLocale, translate } from "@/lib/dictionary";
import { requireActiveMembership } from "@/lib/require-user";
import { listShopsWithMembership } from "@/modules/customers/queries";
import { JoinShopForm } from "@/components/shops/join-shop-form";

export const dynamic = "force-dynamic";

type ShopsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ShopsPage({
  searchParams,
}: ShopsPageProps) {
  const { user } = await requireActiveMembership();
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const shops = await listShopsWithMembership(user.id, search);

  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("shops.title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("shops.subtitle")}
          </p>
        </div>
      </div>

      <form action="/shops" className="mb-6 flex flex-col sm:flex-row gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder={t("shops.searchPlaceholder")}
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
          {t("shops.search")}
        </button>
      </form>

      {shops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">
            {search ? t("shops.noShopMatches", { search }) : t("shops.noShops")}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {search
              ? t("shops.tryDifferentWord")
              : t("shops.noShopsHint")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shops.map((shop) => (
            <li
              key={shop.id}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{shop.name}</p>
                  <p className="text-sm text-ink-muted">
                    {shop.membershipState === "active"
                      ? t("shops.owner")
                      : shop.membershipState === "pending"
                        ? t("shops.joining")
                        : t("shops.customer")}
                  </p>
                </div>
                {shop.membershipState === "none" ? (
                  <JoinShopForm shopId={shop.id} />
                ) : shop.membershipState === "pending" ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    {t("shops.requestPending")}
                  </p>
                ) : (
                  <Link
                    href="/customers/khata"
                    className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    {t("shops.viewKhata")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
