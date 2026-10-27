"use client";

import { useActionState } from "react";

import type { BackupActionState } from "@/app/backups/actions";
import { Button } from "@/components/ui/button";

type BackupButtonProps = {
  action: (
    state: BackupActionState,
    formData: FormData,
  ) => Promise<BackupActionState>;
};

export function BackupButton({ action }: BackupButtonProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.ok ? (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
        >
          Backup created: {state.name}
        </p>
      ) : null}

      {!state.ok && state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-5 text-base sm:w-auto"
        >
          {pending ? "Backing up…" : "Back up now"}
        </Button>
      </div>
    </form>
  );
}
