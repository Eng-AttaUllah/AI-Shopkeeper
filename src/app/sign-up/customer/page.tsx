import type { Metadata } from "next";
import Link from "next/link";

import { CustomerRegistrationForm } from "@/app/customers/sign-up/form";
import { readClientLocale, translate } from "@/lib/dictionary";

export const metadata: Metadata = {
  title: "Create account · EasyShop",
};

export default function CustomerSignUpPage() {
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const nameLabel = t("customerRegistration.name");
  const phoneLabel = t("customerRegistration.phone");
  const passwordLabel = t("customerRegistration.password");
  const registerButtonLabel = t("customerRegistration.registerButton");
  const pendingLabel = t("customerRegistration.creating");
  const hintLabel = t("customerRegistration.phoneHint");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <p className="text-sm font-semibold text-brand">{t("app.name")}</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {t("customerRegistration.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("customerRegistration.subtitle")}
        </p>
        <div className="mt-6">
          <CustomerRegistrationForm
            nameLabel={nameLabel}
            phoneLabel={phoneLabel}
            passwordLabel={passwordLabel}
            registerButtonLabel={registerButtonLabel}
            pendingLabel={pendingLabel}
            hintLabel={hintLabel}
          />
        </div>
        <p className="mt-4 text-sm text-ink-muted text-center">
          {t("customerRegistration.haveAccount")}{" "}
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
