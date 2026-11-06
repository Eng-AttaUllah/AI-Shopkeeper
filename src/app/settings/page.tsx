import Link from "next/link";

import { signOutEverywhereAction } from "@/app/settings/actions";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { Button } from "@/components/ui/button";
import { readClientLocale, translate } from "@/lib/dictionary";
import { requireUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";

const ROLE_LABEL_KEYS: Record<string, string> = {
  OWNER: "settings.roleOwner",
  CASHIER: "settings.roleCashier",
  CUSTOMER: "settings.roleCustomer",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href={user.role === "CUSTOMER" ? "/customers/khata" : "/more"}
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
              {t(ROLE_LABEL_KEYS[user.role] ?? "settings.roleOwner")}
            </dd>
          </div>
          {user.role === "CUSTOMER" ? (
            <div>
              <dt className="text-sm text-ink-muted">{t("settings.phone")}</dt>
              <dd className="font-medium">{user.username}</dd>
            </div>
          ) : null}
        </dl>
        {user.role === "CUSTOMER" ? (
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

      <section id="about" className="scroll-mt-20 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("settings.about")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("settings.aboutBody")}</p>
        <p className="mt-2 text-sm text-ink-muted">{t("settings.aboutOffline")}</p>
        <p className="mt-2 text-sm text-ink-muted">{t("settings.aboutVersion")}</p>
      </section>
    </main>
  );
}
