"use client";

import { useActionState } from "react";

import type { ActionState } from "@/app/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "litre", label: "Litre (L)" },
  { value: "piece", label: "Piece (pcs)" },
  { value: "packet", label: "Packet (pkt)" },
] as const;

export type ProductFormValues = {
  id?: string;
  name?: string;
  category?: string | null;
  unit?: string;
  costPrice?: string;
  salePrice?: string;
  lowStockLevel?: string;
  barcode?: string | null;
  aliases?: string;
};

type ProductFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: ProductFormValues;
  submitLabel: string;
  showOpeningStock?: boolean;
};

const inputClass = "h-11 text-base";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-error">{message}</p>;
}

export function ProductForm({
  action,
  values = {},
  submitLabel,
  showOpeningStock = false,
}: ProductFormProps) {
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
        <input type="hidden" name="productId" value={values.id} />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">{t("products.productName")}</Label>
          <Input
            id="name"
            name="name"
            defaultValue={values.name}
            placeholder="Sugar"
            required
            autoComplete="off"
            className={inputClass}
            aria-invalid={Boolean(errors.name)}
            dir="auto"
          />
          <FieldError message={errors.name} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category">{t("products.categoryOptional")}</Label>
          <Input
            id="category"
            name="category"
            defaultValue={values.category ?? ""}
            placeholder="Grocery"
            autoComplete="off"
            className={inputClass}
            dir="auto"
          />
          <FieldError message={errors.category} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="unit">{t("products.soldBy")}</Label>
          <select
            id="unit"
            name="unit"
            defaultValue={values.unit ?? "kg"}
            className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.unit} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="costPrice">{t("products.costPricePerUnit")}</Label>
          <Input
            id="costPrice"
            name="costPrice"
            defaultValue={values.costPrice}
            placeholder="140"
            inputMode="decimal"
            autoComplete="off"
            required
            className={inputClass}
            aria-invalid={Boolean(errors.costPrice)}
            dir="ltr"
          />
          <FieldError message={errors.costPrice} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="salePrice">{t("products.salePricePerUnit")}</Label>
          <Input
            id="salePrice"
            name="salePrice"
            defaultValue={values.salePrice}
            placeholder="160"
            inputMode="decimal"
            autoComplete="off"
            required
            className={inputClass}
            aria-invalid={Boolean(errors.salePrice)}
            dir="ltr"
          />
          <FieldError message={errors.salePrice} />
        </div>

        {showOpeningStock ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="openingStock">{t("products.openingStock")}</Label>
            <Input
              id="openingStock"
              name="openingStock"
              defaultValue="0"
              inputMode="decimal"
              autoComplete="off"
              required
              className={inputClass}
              aria-invalid={Boolean(errors.openingStock)}
              dir="ltr"
            />
            <FieldError message={errors.openingStock} />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="lowStockLevel">{t("products.lowStockLevelField")}</Label>
          <Input
            id="lowStockLevel"
            name="lowStockLevel"
            defaultValue={values.lowStockLevel ?? "0"}
            inputMode="decimal"
            autoComplete="off"
            required
            className={inputClass}
            aria-invalid={Boolean(errors.lowStockLevel)}
            dir="ltr"
          />
          <p className="text-sm text-ink-muted">
            {t("products.warnLowStock")}
          </p>
          <FieldError message={errors.lowStockLevel} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="barcode">{t("products.barcodeOptional")}</Label>
          <Input
            id="barcode"
            name="barcode"
            defaultValue={values.barcode ?? ""}
            autoComplete="off"
            className={inputClass}
            aria-invalid={Boolean(errors.barcode)}
            dir="ltr"
          />
          <FieldError message={errors.barcode} />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="aliases">{t("products.otherNames")}</Label>
          <Input
            id="aliases"
            name="aliases"
            defaultValue={values.aliases ?? ""}
            placeholder="Cheeni, Shakkar"
            autoComplete="off"
            className={inputClass}
            aria-invalid={Boolean(errors.aliases)}
            dir="auto"
          />
          <p className="text-sm text-ink-muted">
            {t("products.separateCommas")}
          </p>
          <FieldError message={errors.aliases} />
        </div>
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
