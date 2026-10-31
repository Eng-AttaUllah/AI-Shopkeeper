import Link from "next/link";

import { createCustomerAction } from "@/app/customers/actions";
import { CustomerForm } from "@/components/customers/customer-form";
import { readClientLocale, translate } from "@/lib/dictionary";

export default function NewCustomerPage() {
  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href="/customers"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {t("customers.backToCustomers")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {t("customers.addCustomerHeading")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("customers.addCustomerDesc")}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <CustomerForm
          action={createCustomerAction}
          submitLabel={t("customers.saveCustomer")}
        />
      </div>
    </main>
  );
}
