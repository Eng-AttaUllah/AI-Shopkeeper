"use client";

import { useActionState } from "react";

import { changePasswordAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {
    ok: false,
  });
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.ok === false && state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 text-base"
          aria-invalid={state.ok === false && state.fieldErrors?.currentPassword ? true : undefined}
        />
        {state.ok === false && state.fieldErrors?.currentPassword ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.currentPassword}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 text-base"
          aria-invalid={state.ok === false && state.fieldErrors?.newPassword ? true : undefined}
        />
        {state.ok === false && state.fieldErrors?.newPassword ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.newPassword}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t("settings.confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="h-11 text-base"
          aria-invalid={state.ok === false && state.fieldErrors?.confirmPassword ? true : undefined}
        />
        {state.ok === false && state.fieldErrors?.confirmPassword ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 w-full px-5 text-base"
      >
        {pending ? t("settings.changing") : t("settings.change")}
      </Button>
    </form>
  );
}
