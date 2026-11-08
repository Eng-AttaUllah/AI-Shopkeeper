import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCustomerAction } from "@/app/customers/actions";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomer } from "@/modules/customers/queries";
import { requireShopkeeper } from "@/lib/require-user";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const { id } = await params;
  const { shop } = await requireShopkeeper();
  const customer = await getCustomer(shop.id, id);

  if (!customer) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href={`/customers/${customer.id}`}
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          ← {customer.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {await t("customers.editCustomer")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {await t("customers.changingDetails")}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <CustomerForm
          action={updateCustomerAction}
          values={{
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            note: customer.note,
          }}
          submitLabel={await t("products.saveChanges")}
        />
      </div>
    </main>
  );
}
