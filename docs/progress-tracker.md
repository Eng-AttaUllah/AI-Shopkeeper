# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 4 — Dashboard and reports: **Not started**

## Current Goal

- Nothing in progress. Phase 3 is complete and verified end to end.

## Completed

### Phase 0 — Environment setup (complete)

- Next.js 16.4.3 scaffolded with App Router, TypeScript (strict), and Tailwind CSS v4.
- Prisma ORM 7.10.1 with SQLite through the `better-sqlite3` driver adapter.
- Migration `20261025055854_init` creates the `Shop` model; database lives at
  `prisma/dev.db`.
- `prisma7.config.ts` configured with schema, migrations path, and a `tsx` seed command.
- `src/lib/db.ts` — single cached Prisma client built from `DATABASE_URL`.
- `src/lib/money.ts` — integer-paisa conversion, summing, and quantity multiplication.
- `src/lib/format.ts` — `formatPaisa` and `formatDate` (Asia/Karachi).
- `prisma/seed.ts` — idempotent seed creating the demo shop record.
- Home page reads the shop from the database at request time and renders it.
- Design tokens from `ui-context.md` applied in `src/app/globals.css`.
- Tests: 17 passing across `tests/money.test.ts` and `tests/format.test.ts`.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass.
- `README.md`, `.env.example`, `.gitignore` (env, database, backups), `backups/` and
  `src/components/` placeholders, and `src/modules/README.md` created.
- Documentation set filled and `AGENTS.md` added so future sessions load the specs.

### Phase 1 — Products and stock (complete)

- `Product`, `ProductAlias`, and `StockMovement` models with migration
  `20261025065819_add_products_and_stock`. Stock writes and opening stock always write a
  movement row (invariants 3, 6, 9).
- `src/lib/quantity.ts` — integer thousandths helpers (`toMilli`, `fromMilli`,
  `formatQuantity`) and the four supported units.
- `src/lib/result.ts` — shared `Result` type with `ok` / `fail` and field errors.
- `src/modules/products/schema.ts` — Zod schemas for create, update, and stock adjustment;
  alias parsing (accepts the Pashto comma); rupee and quantity patterns.
- `src/modules/products/service.ts` — `createProduct` (product plus OPENING movement in one
  transaction), `updateProduct`, `setProductActive`, `adjustStock` (refuses negative stock,
  always writes a movement).
- `src/modules/products/queries.ts` — `listProducts` (name, alias, category, barcode search),
  `getProduct`, `lowStockProducts`, `inventoryValuePaisa`, `reconcileStock`.
- shadcn/ui initialised (v4 `base-nova` style on Base UI) and the palette from
  `ui-context.md` mapped onto its semantic tokens. Added `button`, `input`, `label`, `card`,
  `badge`, `table`, `select`, `textarea`, `separator`.
- App header with Dashboard and Products navigation.
- `/products` — summary cards (count, low stock, stock value), search, responsive table on
  desktop and stacked cards on mobile, low-stock badge.
- `/products/new` — add form with opening stock.
- `/products/[id]/edit` — details form, stock adjustment form, last 10 stock movements, and
  stop/start selling.
- Server actions in `src/app/products/actions.ts` returning
  `{ ok: true } | { ok: false, error, fieldErrors }`, with `revalidatePath` after mutations.
- Tests: 38 passing across 4 files, including duplicate names, negative prices, opening-stock
  movement, negative-stock refusal, and cached stock reconciliation.
- Verified end to end against the dev server: create (303 redirect), list and search, edit
  prices, adjust stock (+5 → 15 kg), over-draw rejected with a readable message and unchanged
  stock, hide/show product. Test records were removed from `prisma/dev.db` afterwards.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass.

### Phase 2 — Sales (complete)

- `Sale` and `SaleItem` models with migration `20261025102527_add_sales`. Each line stores
  `productName`, `unit`, `unitPricePaisa`, and `unitCostPaisa` snapshots plus the line total
  and line cost (invariant 5). `voidedAt` / `voidedReason` are reserved for Phase 5.
- `src/lib/dates.ts` — `dateKeyInKarachi` for sale numbering; `formatDateTime` added to
  `src/lib/format.ts`.
- `src/lib/zod.ts` — shared `fieldErrors` helper, now used by both modules.
- `src/modules/sales/schema.ts` — cart payload, discount, cash, and note validation. Credit is
  rejected until Phase 3.
- `src/modules/sales/service.ts` — `createSale` in one transaction: re-reads products, rejects
  missing/inactive/short lines, merges duplicate lines, snapshots price and cost, applies the
  discount, computes change, writes the sale and lines, decrements stock, and writes one
  `SALE` movement per line with the sale id as reference (invariants 2, 3, 5, 6).
- `src/modules/sales/queries.ts` — `listSales`, `getSale` in receipt order, `saleSubtotalPaisa`,
  and `saleProfitPaisa` from the cost snapshots.
- `src/modules/products/queries.ts` — `listSellableProducts` for the sell screen.
- `/sell` — search by name, category, or alias; product grid with price and remaining stock;
  cart with +/− and quantity entry; discount; cash received with change; sticky mobile bottom
  bar showing the total and **Complete sale**.
- `/sales` — last 50 sales with receipt number, time, line count, and total; responsive table
  and cards.
- `/sales/[id]` — receipt with line snapshots, subtotal, discount, total, cash, change, and
  note.
- `createSaleAction` in `src/app/sales/actions.ts`; revalidates `/sell`, `/products`, and
  `/sales`, then redirects to the receipt.
- Header navigation now includes Sell and Sales; the home page links to both.
- Tests: 53 passing across 6 files, including atomic rollback, insufficient stock, inactive
  products, duplicate-line merging, fractional quantities, snapshots surviving price changes,
  sequential daily numbers, and cash/discount validation.
- Verified end to end against the dev server: a two-item sale (2 kg Sugar + 3 Soap, Rs. 50
  discount, Rs. 600 cash) produced receipt `20261025-0001`, subtotal Rs. 545.00, total
  Rs. 495.00, change Rs. 105.00, stock 10 → 8 kg and 20 → 17 pcs, and appeared in the sales
  list. An over-sell of 100 kg was rejected with "Only 8 kg of Sugar in stock." and wrote
  nothing. Test records were removed from `prisma/dev.db` afterwards.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass.

### Phase 3 — Customers and credit (complete)

- `Customer` and `Payment` models with migration `20261025104027_add_customers_and_credit`.
  Customer balances are strictly derived from credit sales minus payments, never stored as a
  mutable balance row (invariants 2, 9).
- `src/modules/customers/balance.ts` — `outstandingPaisa` function operating inside a
  `Prisma.TransactionClient` to ensure atomic checks and balance derivation.
- `src/modules/customers/schema.ts` — customer input (name, phone, optional note) and repayment
  validation.
- `src/modules/customers/service.ts` — `createCustomer`, `updateCustomer`, `recordPayment`
  (validates amount > 0, reads outstanding balance within transaction, refuses payments
  exceeding balance).
- `src/modules/customers/queries.ts` — `listCustomersWithBalances` (search by name or phone),
  `listCustomerOptions` for the sell screen, `totalOutstandingPaisa`, `customerBalancePaisa`,
  `customerHistory` (interleaving sales and payments in descending time order), and
  `buildStatementText` (WhatsApp-ready statement).
- `src/modules/sales/service.ts` — extended `createSale` to support `CREDIT` payment method:
  verifies customer exists, rejects credit sales exceeding total or without customer, updates
  balance atomically with stock movements.
- `/customers` — summary cards (Customers, Owing, Total outstanding), search by name or
  phone, responsive table on desktop and cards on mobile.
- `/customers/new` and `/customers/[id]/edit` — customer creation and editing forms.
- `/customers/[id]` — customer detail, outstanding balance badge, full transaction history
  (credit sales and payments), in-page repayment form with live validation, WhatsApp
  shareable statement with one-click link.
- `/sell` — Cash vs Credit toggle; customer selector with real-time balance badge and
  "+ New customer" link; optional cash received input with live "Added to khata" calculation
  and change calculation; disabled submission when credit is chosen without a customer or
  when cash received exceeds total on credit.
- `/sales/[id]` (receipt) and `/sales` (list) — display customer attribution, credit badges,
  and khata breakdown.
- Header navigation and overview updated with Customers link.
- Tests: 69 passing across 7 files, including 16 dedicated tests in `tests/customers.test.ts`.
- Verified end to end: customer creation, credit sale with partial cash (Rs. 240 paid, Rs. 800
  on khata), balance calculation, WhatsApp statement generation, repayment (Rs. 300 paid,
  balance dropped to Rs. 500), and overpayment rejection. Test records were removed from
  `prisma/dev.db` afterwards.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass.

## In Progress

- None.

## Next Up

Phase 4 — Dashboard and reports, in this order:

1. Add `src/modules/reports/queries.ts`: today, this month, this year, and custom date-range
   sales totals, along with gross profit aggregated using the immutable sale-item cost
   snapshots in `Asia/Karachi` timezone (invariants 5, 10).
2. Product performance and stock reports: top-selling products, slow-moving products, inventory
   valuation, and low-stock list.
3. Credit reports: total outstanding khata and list of customers with outstanding balances.
4. Build the dashboard at `/` with summary cards, recent sales, and quick metrics.
5. Build the dedicated `/reports` view with date range pickers, profit graphs (using Recharts),
   and downloadable or printable summaries.
6. Tests: time boundary calculations in `Asia/Karachi`, gross profit calculation across multiple
   items with discount, empty periods, and product sales ranking.

## Open Questions

- Will the shop use a thermal receipt printer? If yes, which model and connection (USB,
  network, Bluetooth)? Needed before receipt printing is scheduled.
- Will a barcode scanner be used? This decides whether barcode entry needs keyboard-wedge
  handling or a camera-based scanner.
- Will a second person (cashier) use the system? This decides how soon roles and per-user
  audit attribution matter.
- Where should backups be stored besides the laptop (external drive, second machine, phone)?
  Local-only backups do not protect against disk failure or theft.
- Which AI provider will be used for the later assistant phase? Deferred, but the adapter
  interface must stay provider-agnostic.
- Should the shop's day be treated as starting at midnight, or does the shopkeeper consider
  the business day to end after closing (for example 2 a.m.)? Affects "today" reporting.

## Architecture Decisions

- **SQLite instead of PostgreSQL.** The shop runs offline on one laptop with no database
  server to install, operate, or maintain, and a backup is a single file copy. PostgreSQL is
  revisited only if multiple devices or shops must share data.
- **Money stored as integer paisa.** Avoids floating-point rounding errors in every total,
  and removes the need for a decimal type that SQLite does not provide.
- **Auth.js (NextAuth) v5 with the Credentials provider and JWT sessions.** Chosen by the
  user. The Credentials provider requires JWT sessions, so sessions are signed cookies rather
  than database rows; a `tokenVersion` field supports invalidation after a password change.
- **No cloud auth or cloud database.** Clerk and hosted Postgres were rejected because the
  shop must keep working without internet.
- **Single tenant, single shop.** One installation serves one shop. Ownership is implicit, and
  every record belongs to that shop through `settings`.
- **English-only interface for v1.** Pashto, RTL, and translation layers are deferred to
  Phase 8. Business text is stored in the database, so adding translations later is additive.
- **Module layout `schema.ts` / `service.ts` / `queries.ts` per domain.** Keeps business rules
  out of UI and lets the future AI layer call exactly the same functions the screens call.
- **Light theme, shadcn/ui, Lucide icons.** Chosen by the user; optimised for daylight
  readability on a phone.
- **`unitCost` and `unitPrice` snapshotted on each sale line.** Historical profit must not
  change when a product's cost price changes later.
- **Generated components and migrations are protected.** `components/ui/*` and committed
  migrations are never hand-edited, so generated code cannot drift into a broken state.
- **Prisma 7 pinned to 7.10.1.** The `latest` dist-tag currently points at an 8.0 release
  candidate; the stable major is 7, and CLI and client versions must match.
- **Prisma 7 driver adapter (`@prisma/adapter-better-sqlite3`).** Prisma 7 no longer ships a
  bundled query engine for SQLite, so the client requires an explicit adapter.
- **Tailwind compiled by `@tailwindcss/postcss`.** The alternative Turbopack `*.css` loader
  rule also matched Next's generated font CSS and broke `next/font` during `next build`.
- **Vitest config uses `.mts`.** Vitest 5 warns when an ESM config is loaded as CommonJS.
- **`npm run dev` uses webpack with polling.** This machine's inotify watcher budget is
  exhausted by other applications; Turbopack and native watching both crash with `ENOSPC`.
  Polling costs some CPU but keeps development usable. `npm run dev:turbo` remains available,
  and production builds still use Turbopack.
- **`@types/node` raised to v22.** Vitest 5 requires Node 22 types; the runtime is Node 22.
- **Project has its own git repository.** The parent directory `/home/attaullah` is itself a
  git repository, so committing from the project would have staged unrelated home files.
  `AI Shop/.git` keeps history isolated.
- **shadcn/ui v4 (`base-nova`) on Base UI.** The current CLI generates components on
  `@base-ui/react` with the `cn` package rather than Radix. It is the maintained default and
  the CLI remains the supported way to add components, so generated files stay upgradeable.
- **Project palette mapped onto shadcn's semantic tokens.** `--primary` is the teal accent,
  `--muted` is the subtle surface, and `--accent` is soft teal. Project utilities keep their
  documented names as `bg-page`, `text-ink`, `text-ink-muted`, `bg-brand`, `border-line`,
  avoiding collisions with shadcn's `muted` and `accent` utilities.
- **Native `<select>` inside forms.** It submits through `FormData` and keeps working without
  JavaScript. The shadcn `select` component stays available for non-form controls.
- **Action state is a discriminated union.** Server actions return `{ ok: true }` or
  `{ ok: false, error, fieldErrors }`, matching the result rule in `code-standards.md`.
- **Sale numbers are `YYYYMMDD-NNNN` per shop day.** Generated inside the sale transaction
  from that day's sale count, with the unique index as a safety net. They are readable for
  end-of-day cash reconciliation.
- **The server never trusts client prices.** The cart payload carries only product id and
  quantity. Price and cost are read from the product row inside the transaction, so a tampered
  or stale browser cannot change what is charged.
- **Sale totals are stored; derived sums are not.** `totalPaisa`, `discountPaisa`, `paidPaisa`,
  and `changePaisa` are records. Subtotal and profit are computed from the immutable lines, so
  there is no second source of truth to keep in sync.
- **Cash only until Phase 3.** `paidPaisa`, `changePaisa`, and `paymentMethod` are already in
  the schema. Credit is additive: a nullable `customerId`, a relaxed paid check, and the
  customer balance in the same transaction.
- **Duplicate cart lines are merged server-side.** The stock check runs once per product, so
  two lines of the same item cannot each pass separately and oversell.
- **Customer balances are always derived, never stored.** Outstanding credit is computed from
  non-voided credit sales minus repayments. This prevents drift between customer rows and sale
  records (invariants 2, 9).
- **Credit sales accept partial cash.** When a buyer pays part of the total upfront,
  `paidPaisa` is captured on the sale and the difference is placed on credit. Paying more than
  the total on credit is rejected.
- **WhatsApp statement format.** Built directly from customer balance and recent transaction
  history, providing a one-click WhatsApp deep link (`wa.me`) for instant debtor reminders.

## Session Notes

- Verified environment: Node.js v22.22.1, npm 9.2.0 (global prefix `/usr/local` is not
  writable, so npm was not upgraded), Python 3.14.4, ffmpeg 8.0.1, no PostgreSQL, no Docker.
- Python 3.14 is too new for guaranteed OpenCV wheels; the camera phase must use its own
  Python 3.12 environment. Nothing in v1 depends on Python.
- `npm run dev` binds to the local network automatically; the start-up log prints a
  `Network:` URL that a phone on the same Wi-Fi can open.
- The Prisma CLI installed project-local skills into `.agents/skills` and `skills-lock.json`.
  They are kept because they document Prisma 7 specifics; duplicate copies under `.claude/`
  and `.windsurf/` were removed.
- `next-env.d.ts` and `src/generated/prisma` are generated and git-ignored.
- The inotify limit (`fs.inotify.max_user_watches`) is 62,571 with almost none free. Raising
  it needs root: `sudo sysctl -w fs.inotify.max_user_watches=524288`. If that is ever done,
  `npm run dev:turbo` becomes the faster option.
- `next dev` appends a "This is NOT the Next.js you know" block to `AGENTS.md` on every run.
  It is committed as-is so the working tree stays clean, and it tells future sessions to read
  the version-matched guides in `node_modules/next/dist/docs/`.
- Restart `npm run dev` after any Prisma schema change or `prisma generate`. The long-running
  server keeps the previously generated client, so new models appear as `undefined` (for
  example `Cannot read properties of undefined (reading 'findMany')`) until it is restarted.
  This happened in both Phase 1 and Phase 2.
- Prisma CLI commands must pass `--config prisma7.config.ts`; the project uses that file name
  rather than Prisma's default `prisma.config.ts`. `migrate dev` does not regenerate the client
  here, so run `npx prisma generate --config prisma7.config.ts` afterwards.
- Server actions were exercised directly over HTTP during Phases 1 and 2 (progressive-
  enhancement form posts), which verified the action wiring as well as the service layer.
