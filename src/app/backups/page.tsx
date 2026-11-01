import Link from "next/link";

import { createBackupAction } from "@/app/backups/actions";
import { BackupButton } from "@/components/backups/backup-button";
import { buttonVariants } from "@/components/ui/button";
import {
  DAILY_BACKUP_RETENTION,
  backupDirectory,
  ensureDailyBackup,
  listBackups,
} from "@/lib/backup";
import { formatDateTime } from "@/lib/format";
import { readClientLocale, translate } from "@/lib/dictionary";

export const dynamic = "force-dynamic";

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function BackupsPage() {
  await ensureDailyBackup().catch((error) => {
    console.error("Daily backup failed:", error);
  });

  const backups = await listBackups();
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{t("backups.backups")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("backups.copySafe")}
          </p>
        </div>
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 px-4 text-base",
          })}
        >
          {await t("nav.dashboard")}
        </Link>
      </header>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("backups.backUpNow")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("backups.makesCopy")}
        </p>
        <div className="mt-4">
          <BackupButton action={createBackupAction} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">
          {t("backups.automaticDaily")}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {t("backups.opensDashboard", { retention: String(DAILY_BACKUP_RETENTION) })}
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          {t("backups.backupsLiveIn")}
        </p>
        <code className="mt-1 block overflow-x-auto rounded-md bg-subtle px-3 py-2 text-sm">
          {backupDirectory()}
        </code>
        <p className="mt-3 text-sm text-ink-muted">
          {t("backups.copyRegularly")}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{t("backups.backupFiles")}</h2>
            <p className="text-sm text-ink-muted">
              {t("backups.newestFirst")}
            </p>
          </div>
          <p className="text-sm text-ink-muted">
            {backups.length} {backups.length === 1 ? t("backups.file") : t("backups.files")}
          </p>
        </div>

        {backups.length === 0 ? (
          <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
            {t("backups.noBackupsYet")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {backups.map((backup) => (
              <li
                key={backup.name}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="break-all font-medium">{backup.name}</p>
                  <p className="text-sm text-ink-muted">
                    {formatDateTime(backup.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums text-ink-muted">
                  {formatSize(backup.sizeBytes)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("backups.restoring")}</h2>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-muted">
          <li>{t("backups.stopApp")}</li>
          <li>{t("backups.copyOver")}</li>
          <li>{t("backups.startAgain")}</li>
        </ol>
        <p className="mt-3 text-sm text-ink-muted">
          {t("backups.restoringReplaces")}
        </p>
      </section>
    </main>
  );
}
