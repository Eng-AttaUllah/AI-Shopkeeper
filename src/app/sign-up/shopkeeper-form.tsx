"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { shopkeeperSignupAction, type ShopkeeperSignupState } from "./actions";

export function ShopkeeperSignupForm({
  nameLabel,
  usernameLabel,
  shopNameLabel,
  passwordLabel,
  registerButtonLabel,
  pendingLabel,
}: {
  nameLabel: string;
  usernameLabel: string;
  shopNameLabel: string;
  passwordLabel: string;
  registerButtonLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ShopkeeperSignupState, FormData>(
    shopkeeperSignupAction,
    null,
  );
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
        />
        {errors.name ? <p className="text-sm text-error">{errors.name}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">{usernameLabel}</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="h-11 text-base"
          aria-invalid={Boolean(errors.username)}
          dir="ltr"
        />
        {errors.username ? (
          <p className="text-sm text-error">{errors.username}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shopName">{shopNameLabel}</Label>
        <Input
          id="shopName"
          name="shopName"
          autoComplete="name"
          autoCapitalize="words"
          required
          className="h-11 text-base"
          aria-invalid={Boolean(errors.shopName)}
        />
        {errors.shopName ? (
          <p className="text-sm text-error">{errors.shopName}</p>
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

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full px-5 text-base"
      >
        {pending ? pendingLabel : registerButtonLabel}
      </Button>
    </form>
  );
}
