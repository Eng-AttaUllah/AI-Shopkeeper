"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { customerRegistrationAction, type CustomerRegistrationState } from "./actions";

export function CustomerRegistrationForm({
  from,
  nameLabel,
  phoneLabel,
  passwordLabel,
  registerButtonLabel,
}: {
  from: string;
  nameLabel: string;
  phoneLabel: string;
  passwordLabel: string;
  registerButtonLabel: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerRegistrationState, FormData>(
    customerRegistrationAction,
    null,
  );
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="from" value={from} />

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{nameLabel}</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          required
          autoFocus
          className="h-11 text-base"
          aria-invalid={Boolean(errors.name)}
          dir="auto"
        />
        {errors.name ? (
          <p className="text-sm text-error">{errors.name}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{phoneLabel}</Label>
        <Input
          id="phone"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          required
          className="h-11 text-base"
          aria-invalid={Boolean(errors.phone)}
          dir="auto"
        />
        {errors.phone ? (
          <p className="text-sm text-error">{errors.phone}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{passwordLabel}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="h-11 text-base"
          aria-invalid={Boolean(errors.password)}
          dir="ltr"
        />
        {errors.password ? (
          <p className="text-sm text-error">{errors.password}</p>
        ) : null}
      </div>

      <p className="text-xs text-ink-muted">
        Your phone number is your username. Use it to sign in.
      </p>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full px-5 text-base"
      >
        {pending ? "Creating account…" : registerButtonLabel}
      </Button>
    </form>
  );
}
