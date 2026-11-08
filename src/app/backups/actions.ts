"use server";

import { revalidatePath } from "next/cache";

import { requireShopkeeper } from "@/lib/require-user";
import { createBackup } from "@/lib/backup";

export type BackupActionState =
  | { ok: true; name: string }
  | { ok: false; error?: string };

export async function createBackupAction(
  _previousState: BackupActionState,
  formData: FormData,
): Promise<BackupActionState> {
  void formData;
  await requireShopkeeper();

  try {
    const backup = await createBackup("manual");

    revalidatePath("/backups");

    return { ok: true, name: backup.name };
  } catch (error) {
    console.error("Manual backup failed:", error);

    return {
      ok: false,
      error:
        "The backup could not be made. Check that the database file is readable and try again.",
    };
  }
}
