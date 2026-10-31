"use client";

import { useActionState } from "react";

import type { CustomerActionState } from "@/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readClientLocale, translate } from "@/lib/dictionary";

export type CustomerFormValues = {
  id?: string;
  name?: string;
  phone?: string | null;
  note?: string | null;
};

type CustomerFormProps = {
  action: (
    state: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
  values?: CustomerFormValues;
  submitLabel: string;
};

export function CustomerForm({
  action,
  values = {},
  submitLabel,
}: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const error = state.ok ? undefined : state.error;
  const errors = (state.ok ? {} : state.fieldErrors) ?? {};
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {values.id ? (
        <input type="hidden" name="customerId" value={values.id} />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("customerForm.customerName")}</Label>
        <Input
          id="name"
          name="name"
          defaultValue={values.name}
          placeholder="Ali Khan"
          required
          autoComplete="off"
          className="h-11 text-base"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? (
          <p className="text-sm text-error">{errors.name}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t("customerForm.phoneOptional")}</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={values.phone ?? ""}
          placeholder="0300 1234567"
          inputMode="tel"
          autoComplete="off"
          className="h-11 text-base"
          aria-invalid={Boolean(errors.phone)}
        />
        {errors.phone ? (
          <p className="text-sm text-error">{errors.phone}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note">{t("customerForm.noteOptional")}</Label>
        <Textarea
          id="note"
          name="note"
          defaultValue={values.note ?? ""}
          placeholder="Neighbour, buys on Fridays"
          rows={3}
          className="text-base"
          aria-invalid={Boolean(errors.note)}
        />
        {errors.note ? (
          <p className="text-sm text-error">{errors.note}</p>
        ) : null}
      </div>

      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-6 text-base sm:w-auto"
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
