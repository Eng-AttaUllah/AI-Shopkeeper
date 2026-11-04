import Link from "next/link";

import { readClientLocale, translate } from "@/lib/dictionary";

const TOOLS = [
  {
    href: "/assistant",
    titleKey: "more.assistantTitle",
    descriptionKey: "more.assistantBody",
  },
  {
    href: "/expenses",
    titleKey: "more.expensesTitle",
    descriptionKey: "more.expensesBody",
  },
  {
    href: "/day-close",
    titleKey: "more.dayCloseTitle",
    descriptionKey: "more.dayCloseBody",
  },
  {
    href: "/alerts",
    titleKey: "more.alertsTitle",
    descriptionKey: "more.alertsBody",
  },
  {
    href: "/backups",
    titleKey: "more.backupsTitle",
    descriptionKey: "more.backupsBody",
  },
  {
    href: "/audit",
    titleKey: "more.auditTitle",
    descriptionKey: "more.auditBody",
  },
] as const;

export default function MorePage() {
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold">{t("more.moreTools")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("more.subtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40 hover:bg-subtle"
          >
            <h2 className="text-lg font-semibold">{t(tool.titleKey)}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t(tool.descriptionKey)}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
