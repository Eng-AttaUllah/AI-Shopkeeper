"use client";

import Link from "next/link";
import { readClientLocale, translate } from "@/lib/dictionary";

export default function SignUpPage() {
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          {t("app.name")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {t("signUp.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("signUp.subtitle")}
        </p>
        <h2 className="mt-4 mb-2 text-sm font-medium text-ink-muted">
          {t("signUp.joinAs")}
        </h2>
        <div className="mt-0 flex flex-col gap-3">
          <Link
            href="/sign-up/shopkeeper"
            className="w-full flex shrink-0 items-center justify-between rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground px-5 py-3 text-sm font-medium transition-colors text-ink"
          >
            {t("signUp.shopkeeper")}
          </Link>
          <Link
            href="/sign-up/customer"
            className="w-full flex shrink-0 items-center justify-between rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground px-5 py-3 text-sm font-medium transition-colors text-ink"
          >
            {t("signUp.customer")}
          </Link>
        </div>
        <p className="mt-4 text-sm text-ink-muted text-center">
          {t("signUp.haveAccount")}{" "}
          <Link
            href="/login"
            className="text-brand underline hover:text-brand-hover"
          >
            {t("customerRegistration.signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
