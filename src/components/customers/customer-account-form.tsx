"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import type { CustomerActionState } from "@/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";

type CustomerAccountFormProps = {
  customerId: string;
  action: (
    state: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
};

export function CustomerAccountForm({
  customerId,
  action,
}: CustomerAccountFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const error = state.ok ? undefined : state.error;
  const errors = (state.ok ? {} : state.fieldErrors) ?? {};
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      ) : null}

      {state.ok ? (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
        >
          {t("customerAccount.created")}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="account-password">{t("customerAccount.password")}</Label>
        <Input
          id="account-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 text-base"
          aria-invalid={Boolean(errors.password)}
          dir="ltr"
        />
        {errors.password ? (
          <p className="text-sm text-error">{errors.password}</p>
        ) : null}
      </div>

      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-5 text-base sm:w-auto"
        >
          {pending ? t("customerAccount.creating") : t("customerAccount.create")}
        </Button>
      </div>
    </form>
  );
}
