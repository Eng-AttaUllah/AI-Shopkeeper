import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const shop = await prisma.shop.findFirst({
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          AI Shopkeeper Assistant
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Environment status</h1>
        <p className="mt-2 text-muted">
          Phase 0 is the foundation only. Products, sales, customers, and
          reports arrive in the next phases.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Database</h2>

        {shop ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Shop</dt>
              <dd className="font-medium">{shop.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Currency</dt>
              <dd className="font-medium">{shop.currency}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Timezone</dt>
              <dd className="font-medium">{shop.timezone}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Created</dt>
              <dd className="font-medium">{formatDate(shop.createdAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
            No shop record found. Run{" "}
            <code className="font-mono text-sm">npm run db:seed</code> to create
            one.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Checks</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            Next.js app is serving this page
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            Prisma is connected to SQLite
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            The Shop model is migrated and readable
          </li>
        </ul>
      </section>

      <footer className="text-sm text-muted">
        Specification: <code className="font-mono">docs/</code> · Next step:
        Phase 1 — products and stock.
      </footer>
    </main>
  );
}
