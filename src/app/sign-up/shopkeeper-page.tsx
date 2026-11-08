import type { Metadata } from "next";
import Link from "next/link";

import { ShopkeeperSignupForm } from "./shopkeeper-form";
import { readClientLocale, translate } from "@/lib/dictionary";

export const metadata: Metadata = {
  title: "Create shop · EasyShop",
};

export default function ShopkeeperSignupPage() {
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <p className="text-sm font-semibold text-brand">{t("app.name")}</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {t("shopkeeperSignup.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("shopkeeperSignup.subtitle")}
        </p>
        <div className="mt-6">
          <ShopkeeperSignupForm
            nameLabel={t("shopkeeperSignup.name")}
            usernameLabel={t("shopkeeperSignup.username")}
            shopNameLabel={t("shopkeeperSignup.shopName")}
            passwordLabel={t("shopkeeperSignup.password")}
            registerButtonLabel={t("shopkeeperSignup.registerButton")}
            pendingLabel={t("shopkeeperSignup.creating")}
          />
        </div>
        <p className="mt-4 text-sm text-ink-muted text-center">
          {t("shopkeeperSignup.haveAccount")}{" "}
          <Link
            href="/login"
            className="text-brand underline hover:text-brand-hover"
          >
            {t("login.signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
