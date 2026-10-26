import Link from "next/link";

import { createCustomerAction } from "@/app/customers/actions";
import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href="/customers"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          ← Customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add customer</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Only a name is required. A phone number and note make the khata easier
          to find later.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <CustomerForm
          action={createCustomerAction}
          submitLabel="Add customer"
        />
      </div>
    </main>
  );
}
