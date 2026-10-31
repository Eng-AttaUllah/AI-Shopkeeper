"use client";

import { useActionState, useEffect, useRef } from "react";

import type { ExpenseActionState } from "@/app/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORIES } from "@/modules/expenses/schema";

type ExpenseFormProps = {
  today: string;
  action: (
    state: ExpenseActionState,
    formData: FormData,
  ) => Promise<ExpenseActionState>;
  t: (key: string, params?: Record<string, string>) => string;
  categoryT: (category: string) => string;
};

export function ExpenseForm({ today, action, t, categoryT }: ExpenseFormProps) {
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
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
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
          {t("expenses.expenseRecorded")}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-category">{t("expenses.category")}</Label>
          <select
            id="expense-category"
            name="category"
            defaultValue="OTHER"
            className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryT(category)}
              </option>
            ))}
          </select>
          {errors.category ? (
            <p className="text-sm text-error">{errors.category}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-amount">{t("expenses.amount")} (Rs.)</Label>
          <Input
            id="expense-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1500"
            required
            className="h-11 text-base"
            aria-invalid={Boolean(errors.amount)}
          />
          {errors.amount ? (
            <p className="text-sm text-error">{errors.amount}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-date">{t("expenses.expenseDate")}</Label>
          <Input
            id="expense-date"
            name="date"
            type="date"
            defaultValue={today}
            required
            className="h-11 text-base"
            aria-invalid={Boolean(errors.date)}
          />
          {errors.date ? (
            <p className="text-sm text-error">{errors.date}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-note">{t("expenses.note")} (optional)</Label>
          <Input
            id="expense-note"
            name="note"
            autoComplete="off"
            placeholder="Electricity bill for October"
            className="h-11 text-base"
            aria-invalid={Boolean(errors.note)}
          />
          {errors.note ? (
            <p className="text-sm text-error">{errors.note}</p>
          ) : null}
        </div>
      </div>

      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-5 text-base sm:w-auto"
        >
          {pending ? t("expenses.saving") : t("expenses.saveExpense")}
        </Button>
      </div>
    </form>
  );
}
