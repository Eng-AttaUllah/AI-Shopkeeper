import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { readClientLocale, translate } from "@/lib/dictionary";
import { requireActiveMembership } from "@/lib/require-user";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const { user, shop, membership } = await requireActiveMembership();

  // A customer's memberships (shops they've joined). In 13.5 the shopkeeper
  // creates their shop and the customer's account, but the browse-and-join
  // flow lands in 13.6.
  const memberships = await prisma.shopMembership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { shop: true },
    orderBy: { createdAt: "desc" },
  });

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
        {memberships.length === 0 && (
          <Link
            href="/settings"
            className={buttonVariants({ className: "h-11 px-4 text-base" })}
          >
            {t("shops.settings")}
          </Link>
        )}
      </div>

      {memberships.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-medium">{t("shops.noShops")}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {t("shops.noShopsHint")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {memberships.map((membership) => (
            <li
              key={membership.id}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{membership.shop.name}</p>
                  <p className="text-sm text-ink-muted">
                    {membership.role === "OWNER"
                      ? t("shops.owner")
                      : t("shops.customer")}
                  </p>
                </div>
                <Link
                  href="/customers/khata"
                  className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-hover"
                >
                  {t("shops.viewKhata")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {memberships.length > 0 && (
        <p className="mt-4 text-sm text-ink-muted text-center">
          {t("shops.joinComingSoon")}
        </p>
      )}
    </main>
  );
}
