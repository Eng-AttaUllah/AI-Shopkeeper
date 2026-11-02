import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { readClientLocale, translate } from "@/lib/dictionary";

export const metadata: Metadata = {
  title: "Sign in · AI Shopkeeper Assistant",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "/";
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const usernameLabel = t("login.username");
  const passwordLabel = t("login.password");
  const signInButtonLabel = t("login.signInButton");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <p className="text-sm font-semibold text-brand">AI Shopkeeper</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("login.signIn")}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("login.useAccount")}
        </p>
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
            href="/customers/sign-up"
            className="text-brand underline hover:text-brand-hover"
          >
            {t("customerRegistration.signUpLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
