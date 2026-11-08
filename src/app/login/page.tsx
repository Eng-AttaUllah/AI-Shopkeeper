import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { readClientLocale, translate } from "@/lib/dictionary";

export const metadata: Metadata = {
  title: "Sign in · EasyShop",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string | string[];
    changed?: string | string[];
    signedOutEverywhere?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "/";
  const passwordChanged = params.changed === "1";
  const signedOutEverywhere = params.signedOutEverywhere === "1";
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const usernameLabel = t("login.username");
  const passwordLabel = t("login.password");
  const signInButtonLabel = t("login.signInButton");
  const passwordChangedLabel = t("login.passwordChanged");
  const signedOutEverywhereLabel = t("login.signedOutEverywhere");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line border-t-4 border-t-brand bg-surface p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <Image
            src="/logo.svg"
            alt=""
            width={32}
            height={32}
            unoptimized
            className="size-8"
          />
          {t("app.name")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{t("login.signIn")}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("login.useAccount")}
        </p>
        {passwordChanged ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand"
          >
            {passwordChangedLabel}
          </p>
        ) : null}
        {signedOutEverywhere ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand"
          >
            {signedOutEverywhereLabel}
          </p>
        ) : null}
        <div className="mt-6">
          <LoginForm
            from={from}
            usernameLabel={usernameLabel}
            passwordLabel={passwordLabel}
            signInButtonLabel={signInButtonLabel}
          />
        </div>
        <p className="mt-4 text-sm text-ink-muted text-center">
          {t("customerRegistration.newCustomer")}{" "}
          <Link
            href="/sign-up"
            className="text-brand underline hover:text-brand-hover"
          >
            {t("customerRegistration.signUpLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
