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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Backups</h1>
          <p className="mt-1 text-sm text-ink-muted">
            A copy of the shop database you can keep somewhere safe.
          </p>
        </div>
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 px-4 text-base",
          })}
        >
          Dashboard
        </Link>
      </header>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Back up now</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Makes a consistent copy while the app is running.
        </p>
        <div className="mt-4">
          <BackupButton action={createBackupAction} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Automatic daily backups</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Opening the dashboard makes one backup per day. The last{" "}
          {DAILY_BACKUP_RETENTION} daily backups are kept.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Backups live in:
        </p>
        <code className="mt-1 block overflow-x-auto rounded-md bg-subtle px-3 py-2 text-sm">
          {backupDirectory()}
        </code>
        <p className="mt-3 text-sm text-ink-muted">
          Copy a backup to a USB drive or another computer regularly. If the
          laptop is lost, a backup on the same laptop is lost with it.
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Backup files</h2>
            <p className="text-sm text-ink-muted">Newest first.</p>
          </div>
          <p className="text-sm text-ink-muted">
            {backups.length} {backups.length === 1 ? "file" : "files"}
          </p>
        </div>

        {backups.length === 0 ? (
          <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
            No backups yet. Use “Back up now” above.
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
        <h2 className="text-lg font-semibold">Restoring a backup</h2>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-muted">
          <li>Stop the app.</li>
          <li>
            Copy the chosen backup file over{" "}
            <code className="rounded bg-subtle px-1 py-0.5">prisma/dev.db</code>.
          </li>
          <li>Start the app again and check the dashboard.</li>
        </ol>
        <p className="mt-3 text-sm text-ink-muted">
          Restoring replaces every sale, product, and customer with the data in
          the backup.
        </p>
      </section>
    </main>
  );
}
