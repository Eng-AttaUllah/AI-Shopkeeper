import Link from "next/link";

import { approveJoinRequestAction } from "@/app/settings/actions";
import { cancelJoinRequestAction } from "@/app/settings/actions";
import { leaveShopAction } from "@/app/settings/actions";
import { rejectJoinRequestAction } from "@/app/settings/actions";
import { signOutAction } from "@/app/auth-actions";
import { signOutEverywhereAction } from "@/app/settings/actions";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { Button } from "@/components/ui/button";
import { JoinRequestForm } from "@/components/shops/join-request-form";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { readClientLocale, translate } from "@/lib/dictionary";
import { requireShopkeeper, requireUser } from "@/lib/require-user";
import {
  customerBalancePaisa,
  listShopsWithMembership,
} from "@/modules/customers/queries";
import { listJoinRequests } from "@/modules/customers/service";

export const dynamic = "force-dynamic";

const ROLE_LABEL_KEYS: Record<string, string> = {
  SHOPKEEPER: "settings.roleOwner",
  CASHIER: "settings.roleCashier",
  CUSTOMER: "settings.roleCustomer",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const isCustomer = user.accountType === "CUSTOMER";
  const isShopkeeper = user.accountType === "SHOPKEEPER";

  const myShops = isCustomer ? await listShopsWithMembership(user.id) : [];

  const balances = new Map<string, string>();
  if (isCustomer) {
    for (const shop of myShops) {
      if (shop.membershipState === "active") {
        const membership = await prisma.shopMembership.findFirst({
          where: {
            userId: user.id,
            shopId: shop.id,
            status: "ACTIVE",
            role: "CUSTOMER",
          },
          select: { customerId: true },
        });
        if (membership?.customerId) {
          const balance = await customerBalancePaisa(shop.id, membership.customerId);
          balances.set(shop.id, formatPaisa(balance));
        }
      }
    }
  }

  let shopkeeperShop: { id: string; name: string } | null = null;
  if (isShopkeeper) {
    const { shop } = await requireShopkeeper();
    shopkeeperShop = { id: shop.id, name: shop.name };
  }

  const joinRequests =
    shopkeeperShop ? await listJoinRequests(shopkeeperShop.id) : [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href={user.accountType === "CUSTOMER" ? "/customers/khata" : "/more"}
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {t("settings.back")}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("settings.subtitle")}</p>
      </div>

      <section id="account" className="scroll-mt-20 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("settings.account")}</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">{t("settings.username")}</dt>
            <dd className="font-medium">{user.username}</dd>
          </div>
          {user.name ? (
            <div>
              <dt className="text-sm text-ink-muted">{t("settings.name")}</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-sm text-ink-muted">{t("settings.role")}</dt>
            <dd className="font-medium">
              {t(ROLE_LABEL_KEYS[user.accountType] ?? "settings.roleOwner")}
            </dd>
          </div>
          {user.accountType === "CUSTOMER" ? (
            <div>
              <dt className="text-sm text-ink-muted">{t("settings.phone")}</dt>
              <dd className="font-medium">{user.username}</dd>
            </div>
          ) : null}
        </dl>
        {user.accountType === "CUSTOMER" ? (
          <p className="mt-3 text-sm text-ink-muted">{t("settings.phoneHint")}</p>
        ) : null}
      </section>

      <section id="security" className="scroll-mt-20 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("settings.security")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("settings.securityHint")}
        </p>

        <h3 id="change-password" className="mt-5 scroll-mt-20 text-base font-semibold">
          {t("settings.changePassword")}
        </h3>
        <div className="mt-3 max-w-sm">
          <ChangePasswordForm />
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-base font-semibold">{t("settings.signOut")}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {t("settings.signOutHint")}
          </p>
          <form action={signOutAction} className="mt-3">
            <Button type="submit" variant="outline" className="h-11 px-4 text-base">
              {t("settings.signOut")}
            </Button>
          </form>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-base font-semibold">
            {t("settings.signOutEverywhere")}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {t("settings.signOutEverywhereHint")}
          </p>
          <form action={signOutEverywhereAction} className="mt-3">
            <Button type="submit" variant="outline" className="h-11 px-4 text-base">
              {t("settings.signOutEverywhereButton")}
            </Button>
          </form>
        </div>
      </section>

      {isCustomer && myShops.length > 0 ? (
        <section id="my-shops" className="scroll-mt-20 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">{t("settings.myShops")}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t("settings.myShopsHint")}
          </p>
          <ul className="mt-3 divide-y divide-line">
            {myShops.map((shop) => {
              const active = shop.membershipState === "active";
              const pending = shop.membershipState === "pending";

              return (
                <li key={shop.id} className="py-3 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{shop.name}</p>
                      <p className="text-sm text-ink-muted">
                        {active
                          ? t("settings.membershipActive")
                          : pending
                            ? t("settings.membershipPending")
                            : t("settings.membershipRemoved")}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                      {active ? (
                        <>
                          <div className="flex items-end gap-1">
                            <span className="font-semibold text-brand">
                              {balances.get(shop.id) ?? "0.00"}
                            </span>
                            <span className="text-xs text-ink-muted">
                              {t("settings.outstandingBalance")}
                            </span>
                          </div>
                          <form
                            action={leaveShopAction}
                            className="mt-2 sm:mt-0"
                            onSubmit={(event) => {
                              if (
                                !window.confirm(
                                  t("settings.confirmLeave", {
                                    shop: shop.name,
                                  }),
                                )
                              ) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="membershipId" value={shop.id} />
                            <Button
                              type="submit"
                              variant="destructive"
                              className="h-10 px-4 text-sm"
                            >
                              {t("settings.leaveShop")}
                            </Button>
                          </form>
                        </>
                      ) : pending ? (
                        <form
                          action={cancelJoinRequestAction}
                          className="mt-2 sm:mt-0"
                          onSubmit={(event) => {
                            if (
                              !window.confirm(
                                t("settings.cancelRequestHint", {
                                  shop: shop.name,
                                }),
                              )
                            ) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="membershipId" value={shop.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            className="h-10 px-4 text-sm"
                          >
                            {t("settings.cancelRequest")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : isCustomer ? (
        <p className="mt-3 text-sm text-ink-muted">
          {t("settings.noBalance")}
        </p>
      ) : null}

      {shopkeeperShop ? (
        <section id="join-requests" className="scroll-mt-20 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">{t("shops.joinRequests")}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t("shops.joinRequestsHint")}
          </p>

          {joinRequests.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              {t("shops.noJoinRequests")}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {joinRequests.map((joinRequest) => (
                <li
                  key={joinRequest.id}
                  className="flex flex-col gap-3 py-3 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{joinRequest.user.username}</p>
                      <p className="text-sm text-ink-muted">
                        {new Date(joinRequest.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <JoinRequestForm
                        membershipId={joinRequest.id}
                        approveAction={approveJoinRequestAction}
                        rejectAction={rejectJoinRequestAction}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section id="about" className="scroll-mt-20 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("settings.about")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("settings.aboutBody")}</p>
        <p className="mt-2 text-sm text-ink-muted">{t("settings.aboutOffline")}</p>
        <p className="mt-2 text-sm text-ink-muted">{t("settings.aboutVersion")}</p>
      </section>
    </main>
  );
}
