import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";

import { KARACHI_TIME_ZONE, dateKeyInKarachi } from "@/lib/dates";

/**
 * Database backups.
 *
 * A backup is a consistent copy of the SQLite file made with SQLite's online
 * backup API, so it is safe while the app is running. Daily backups are
 * produced on demand by the dashboard (once per shop day) and manual backups
 * come from the Backups screen. The last 30 daily files are kept.
 */

export const DAILY_BACKUP_RETENTION = 30;

export type BackupKind = "daily" | "manual";

export type BackupFile = {
  name: string;
  path: string;
  sizeBytes: number;
  createdAt: Date;
};

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: KARACHI_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function backupDirectory(): string {
  return process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.resolve(process.cwd(), "backups");
}

/** Absolute path of the SQLite file named by DATABASE_URL. */
export function resolveDatabasePath(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set, so a backup cannot be made.");
  }

  const withoutQuery = url.split("?")[0] ?? url;
  const raw = withoutQuery.startsWith("file:")
    ? withoutQuery.slice("file:".length)
    : withoutQuery;

  if (raw === ":memory:" || raw === "") {
    throw new Error("The in-memory database cannot be backed up to a file.");
  }

  return path.isAbsolute(raw)
    ? raw
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), raw);
}

function fileStamp(date: Date): string {
  const day = dateKeyInKarachi(date);
  const time = TIME_FORMATTER.format(date).replaceAll(":", "");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  return `${day}-${time}${milliseconds}`;
}

async function ensureDirectory(): Promise<void> {
  await mkdir(backupDirectory(), { recursive: true });
}

/** Create one backup now. Returns the file that was written. */
export async function createBackup(
  kind: BackupKind,
  now = new Date(),
): Promise<BackupFile> {
  await ensureDirectory();

  const name = `${kind}-${fileStamp(now)}.db`;
  const destination = path.join(backupDirectory(), name);
  const database = new Database(resolveDatabasePath(), {
    readonly: true,
    fileMustExist: true,
  });

  try {
    await database.backup(destination);
  } finally {
    database.close();
  }

  if (kind === "daily") {
    await pruneDailyBackups();
  }

  const info = await stat(destination);

  return {
    name,
    path: destination,
    sizeBytes: info.size,
    createdAt: info.mtime,
  };
}

/** All backup files, newest first. */
export async function listBackups(): Promise<BackupFile[]> {
  await ensureDirectory();

  const entries = await readdir(backupDirectory(), { withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".db"),
  );

  const backups = await Promise.all(
    files.map(async (entry) => {
      const filePath = path.join(backupDirectory(), entry.name);
      const info = await stat(filePath);

      return {
        name: entry.name,
        path: filePath,
        sizeBytes: info.size,
        createdAt: info.mtime,
      };
    }),
  );

  return backups.sort((a, b) => b.name.localeCompare(a.name));
}

async function pruneDailyBackups(): Promise<void> {
  const daily = (await listBackups()).filter((file) =>
    file.name.startsWith("daily-"),
  );

  await Promise.all(
    daily
      .slice(DAILY_BACKUP_RETENTION)
      .map((file) => unlink(file.path).catch(() => undefined)),
  );
}

let lastDailyKey: string | null = null;
let dailyBackupPromise: Promise<BackupFile | null> | null = null;

/**
 * Make sure today's daily backup exists. Safe to call on every dashboard load:
 * after the first check it returns immediately for the rest of the day, and two
 * simultaneous first loads share one backup.
 */
export async function ensureDailyBackup(
  now = new Date(),
): Promise<BackupFile | null> {
  const key = dateKeyInKarachi(now);

  if (lastDailyKey === key) {
    return null;
  }

  if (dailyBackupPromise) {
    return dailyBackupPromise;
  }

  dailyBackupPromise = (async () => {
    const existing = (await listBackups()).find((file) =>
      file.name.startsWith(`daily-${key}-`),
    );

    if (existing) {
      lastDailyKey = key;
      return null;
    }

    const backup = await createBackup("daily", now);
    lastDailyKey = key;

    return backup;
  })();

  try {
    return await dailyBackupPromise;
  } finally {
    dailyBackupPromise = null;
  }
}
