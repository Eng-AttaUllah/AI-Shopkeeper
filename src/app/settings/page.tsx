import Link from "next/link";

import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { readClientLocale, translate } from "@/lib/dictionary";
import { requireOwner } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireOwner();
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/more"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {t("settings.backToMore")}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("settings.subtitle")}</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">{t("settings.signedInAs")}</p>
        <p className="font-medium">{user.username}</p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("settings.changePassword")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("settings.changePasswordHint")}
        </p>
        <div className="mt-4 max-w-sm">
          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
