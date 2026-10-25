"use client";

import { useActionState, useEffect, useRef } from "react";

import type { CustomerActionState } from "@/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PaymentFormProps = {
  customerId: string;
  action: (
    state: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
};

export function PaymentForm({ customerId, action }: PaymentFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);

  const error = state.ok ? undefined : state.error;
  const errors = (state.ok ? {} : state.fieldErrors) ?? {};

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

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
          Payment recorded.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Amount received (Rs.)</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="500"
          required
          className="h-11 text-base"
          aria-invalid={Boolean(errors.amount)}
        />
        {errors.amount ? (
          <p className="text-sm text-error">{errors.amount}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="payment-note">Note (optional)</Label>
        <Input
          id="payment-note"
          name="note"
          autoComplete="off"
          placeholder="Cash paid at the shop"
          className="h-11 text-base"
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
          className="h-11 w-full px-5 text-base sm:w-auto"
        >
          {pending ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
