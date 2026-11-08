import { createSaleAction } from "@/app/sales/actions";
import { SellScreen } from "@/components/sales/sell-screen";
import { listCustomerOptions } from "@/modules/customers/queries";
import { listSellableProducts } from "@/modules/products/queries";
import { requireShopkeeper } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const { shop } = await requireShopkeeper();
  const [products, customers] = await Promise.all([
    listSellableProducts(shop.id),
    listCustomerOptions(shop.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-6 pb-28 lg:pb-6">
      <div>
        <h1 className="text-2xl font-semibold">New sale</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tap products, set quantities, then complete the sale.
        </p>
      </div>

      <SellScreen
        products={products}
        customers={customers}
        action={createSaleAction}
      />
    </main>
  );
}
