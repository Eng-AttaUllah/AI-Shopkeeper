# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 5 — Expenses and hardening: **Complete**

## Current Goal

- Nothing in progress. Phase 5 is complete and verified end to end. Auth.js remains
  unscheduled, and the app is still open to the shop's local network.

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

- `Customer` and `Payment` models plus a nullable `Sale.customerId` with migration
  `20261026062624_add_customers_and_credit`. Credit sales and repayments are separate rows;
  the balance is always derived, never stored (invariant 9).
- `src/modules/customers/balance.ts` — `outstandingPaisa(db, customerId)` returns unpaid
  amounts on non-voided credit sales minus recorded payments. It accepts a transaction client
  so a sale or payment can check the balance inside the transaction that writes it.
- `src/modules/customers/schema.ts` — Zod schemas for customer details and repayments (name
  length, phone character set, rupee amount with at most two decimals).
- `src/modules/customers/service.ts` — `createCustomer`, `updateCustomer`, and
  `recordPayment`. A repayment reads the balance inside one transaction and rejects an amount
  above it, so no customer can ever be owed money by the shop.
- `src/modules/customers/queries.ts` — search by name or phone, per-customer and total
  outstanding balances, customer options for the sell screen, a merged sale/payment history,
  and `buildStatementText` for the WhatsApp message. Voided sales are excluded.
- `src/modules/sales/*` — `createSale` now accepts `CREDIT`. A credit sale requires an
  existing customer, allows a partial cash amount up to the total, rejects overpayment, and
  records `changePaisa = 0`; the unpaid amount becomes the khata balance. Stock and money
  writes stay in the same transaction (invariants 2, 3, 5, 6). A customer on a cash sale is
  ignored.
- `/customers` — totals (customers, owing, total outstanding), search, and responsive table
  and cards. `/customers/new`, `/customers/[id]/edit` — details forms. `/customers/[id]` —
  derived balance, merged history, repayment form (only while something is owed), and a
  WhatsApp statement link.
- `/sell` — Cash / Credit (khata) toggle, customer select showing each balance, optional cash
  received on a credit sale, and a live "Added to khata" amount. **New customer** opens in a
  new tab so the cart is kept; the sell screen re-fetches server data when the tab regains
  focus or visibility, so the new customer appears without a manual reload.
- Receipt and sales list show the credit customer and the khata amount; cash receipts keep the
  cash/change rows.
- Header navigation now includes Customers and wraps onto a second row on narrow phones
  instead of overflowing; the page never scrolls horizontally.
- Tests: 69 passing across 7 files. They cover credit balance math, partial cash, missing or
  unknown customer, credit overpayment, cash sales leaving balances untouched, repayment
  limits, merged history, statement text, and the FK-safe cleanup order.
- Verified end to end against a copy of the dev database: customer creation (303 redirect),
  a credit sale of 2 × Dove Shampo at Rs. 400 with Rs. 300 paid (balance Rs. 500.00, stock
  12 → 10, `changePaisa` 0), a Rs. 200 repayment (balance Rs. 300.00), overpayment rejected
  with "Only Rs. 300.00 is outstanding.", zero and invalid amounts rejected, a cash sale
  unaffected, a credit sale without a customer rejected, and a credit overpayment rejected.
  Receipts, sales list, customer list, history, and edit page all render correctly with no
  server errors.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass.

### Phase 4 — Dashboard and reports (complete)

- No schema change and no migration: reporting reads the existing sale lines and customer
  balances.
- `src/lib/dates.ts` — shop-local range helpers: `karachiDateTime`, `startOfKarachiDay`,
  `startOfKarachiMonth`, `startOfKarachiYear`, `addKarachiDays`, `karachiDayRange`,
  `karachiMonthRange`, `karachiYearRange`, `karachiDateKeyToDate`, `isoDateKeyInKarachi`,
  `eachKarachiDay`, and `eachKarachiMonth`. Offsets come from `Intl` rather than a hardcoded
  +05:00, so a future daylight-saving change cannot shift a boundary (invariant 10).
- `src/modules/reports/schema.ts` — validates report search params. An unknown period falls
  back to today; custom dates are checked as real `YYYY-MM-DD` shop dates.
- `src/modules/reports/queries.ts` — `resolveReportRange`, `salesSummary`, `productSales`,
  `slowMovingProducts`, `salesSeries`, and `creditOverview`. Revenue is recognised at sale
  time; voided sales are excluded everywhere; profit uses the line cost snapshots.
- `/` rebuilt as the dashboard: today's revenue, profit, credit given, and outstanding khata;
  month-to-date revenue and profit; a 14-day revenue chart; recent sales; low stock and
  inventory value; and the customers who owe the most.
- `/reports` — Today / This month / This year / Custom, with a summary (sales, revenue,
  discounts, gross profit, credit given), a day or month revenue chart, per-product quantity,
  line sales and profit, best sellers, and slow movers. Custom ranges use real date inputs and
  reject a start after the end.
- `src/components/reports/*` — a summary card and a server-rendered bar chart. No chart library
  was added; the chart is plain markup and carries an accessible table for screen readers.
- Header navigation includes Reports. On narrow phones the nav row scrolls horizontally
  instead of growing to a third row, and the page itself never scrolls sideways.
- Tests: 95 passing across 8 files. They cover Karachi midnight, month and year edges,
  month-to-date/year-to-date ranges, custom-range validation, profit from cost snapshots after
  a price change, credit counted once with repayments excluded from revenue, discounts, voided
  sales, per-product grouping and ranking, slow movers, daily and monthly buckets, and empty
  periods.
- Verified against a copy of the dev database: the dashboard showed Rs. 400.00 revenue,
  Rs. 50.00 profit, Rs. 400.00 credit given, and Rs. 400.00 outstanding. `/reports` showed the
  same totals for today, 26 daily points for October, 10 monthly points for 2026, a 26-day
  custom range, zeros for an empty range, and a readable error with a month fallback for an
  inverted range. No server errors.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass.

### Phase 5 — Expenses and hardening (complete)

- Migration `20261026184011_add_expenses_audit_and_cash_reconciliation` adds `Expense`,
  `AuditLog`, and `CashReconciliation`. Migration `20261026185725_add_audit_actor_and_state`
  adds the audit `actor`, `before`, and `after` fields, so invariant 7 is satisfied rather
  than deferred.
- `src/lib/audit.ts` — `writeAudit` writes inside the caller's transaction and
  `listAuditLogs` reads newest first. Every money or stock mutation now records actor
  (`local` until sign-in exists), action, entity type/id, summary, and before/after JSON. A
  failed transaction leaves neither the change nor its audit row.
- `src/modules/expenses/*` — Zod-validated categories (RENT, ELECTRICITY, SALARIES,
  TRANSPORT, OTHER), rupee-to-paisa conversion, and a shop-local midnight `spentAt`. Expenses
  are append-only; a correction is a new expense. `/expenses` records an expense, lists the
  last 50, and shows the month-to-date total.
- `/reports` now shows six cards: sales, revenue, gross profit, expenses, net profit, and
  credit given. Net profit is gross profit minus expenses in the selected range. The dashboard
  month strip adds expenses and net profit, and the dashboard links to `/day-close`.
- Void workflow: `voidSale` requires a reason, refuses an already-voided sale, restores every
  line with a `VOID` `StockMovement`, sets `voidedAt` / `voidedReason`, and writes a
  `SALE_VOIDED` audit row in the same transaction. A credit sale with repayments applied
  cannot be voided because the derived khata balance would go negative; refunds are not
  implemented. A credit sale with only counter cash can be voided. Reports and khata already
  exclude voided sales. The receipt page shows the void form and a voided banner.
- Cash reconciliation: `src/modules/cash/*` computes expected cash as cash sales + cash paid
  on credit sales + repayments − expenses, excluding voided sales. `/day-close` shows today's
  breakdown, saves a counted-cash check per shop day (re-running updates that day), and lists
  the last 14 checks. Expenses are assumed paid from the drawer. A saved check is a snapshot;
  a later void changes the live breakdown but does not rewrite the saved check. A cash refund
  for a voided sale is not recorded; the void simply removes the sale from expected cash.
- Backups: `src/lib/backup.ts` uses SQLite's online backup API through `better-sqlite3`, so a
  copy is consistent while the app is running. The dashboard and `/backups` ensure one daily
  backup per shop day; the last 30 daily files are kept; manual backups are kept until
  deleted. `/backups` lists files and documents restore as a file copy with the app stopped.
  A backup was opened with `better-sqlite3` and its tables were read to verify it restores.
- `/audit` lists the last 100 entries with actor, action, time, and expandable before/after
  JSON. `/more` groups Expenses, Day close, Backups, and Audit log; the header nav adds More.
- `better-sqlite3@12.11.1` is now a direct dependency (it was already the Prisma adapter
  driver) and `@types/better-sqlite3` is a dev dependency, solely for the backup API.
- Tests: 116 passing across 13 files. New tests cover expense validation and range totals,
  void stock/khata/audit behavior, the repayment guard, audit before/after and rollback, cash
  math and day upsert, net profit, daily backup idempotency, simultaneous daily-backup
  sharing, 30-file retention, and opening a backup.
- Verified on a copy of the dev database: recorded a Rs. 100 expense, a Rs. 400 cash sale, and
  a counted-cash check of Rs. 300 (expected Rs. 300, balanced); voided the sale and saw stock
  11 → 11, the saved check stay at Rs. 300, the live expected cash drop to −Rs. 100 (the
  expense), net profit −Rs. 100, four audit rows with before/after, and a manual backup
  containing the expense, sale, audit rows, and cash check. The real database was not changed.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass. The build has
  no dynamic-filesystem warning; the DB path is marked `/*turbopackIgnore: true*/`.

## In Progress

- None.

## Next Up

Phase 6 — Assistant (read-only), after the auth question is settled. The assistant must call
the same `src/modules` queries and services the screens call; it must not write money or stock
directly. Before starting, decide when Auth.js sign-in is scheduled and whether the assistant
may answer questions about the whole shop or only the signed-in user's data. Phases 0–5, the
sellable v1, are complete.

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
  the business day to end after closing (for example 2 a.m.)? Affects "today" reporting. The
  current implementation uses midnight.
- When should Auth.js sign-in be scheduled? `docs/architecture.md` lists it and success
  criterion 1 mentions a signed-in shopkeeper, but no implementation phase names it and the
  app is currently open to anyone on the shop's network.
- How should a credit sale with repayments already applied be corrected? The current void
  guard refuses it because removing the unpaid amount would make the derived khata balance
  negative, and there is no refund or payment-reversal record yet. Options: add a refund record
  that reduces the customer's payments, or allow the void and carry a credit balance owed by
  the shop. Until one is chosen, the shopkeeper must correct it outside the app. A cash refund
  for a voided cash sale is also unrecorded: the void removes the sale from expected cash, so
  the refund is handled outside the app.

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
- **Khata balance is derived, never stored.** `outstandingPaisa` subtracts recorded payments
  from the unpaid amounts of non-voided credit sales. A stored balance would be a second
  source of truth that could drift after a void or a failed write.
- **Repayments are guarded inside their transaction.** `recordPayment` reads the balance and
  inserts the payment in one `$transaction`, so two simultaneous repayments cannot overpay and
  a customer can never be owed money by the shop.
- **A credit sale may take partial cash.** `paidPaisa` is at most the total, `changePaisa`
  stays 0 on credit, and the remainder becomes the khata balance. Cash sales still require
  full payment.
- **A credit sale requires an existing customer.** The sell screen links to a new tab for
  creating one instead of embedding a second form, so the cart is never lost. The sell screen
  refreshes on focus and visibility so the new customer appears without a manual reload.
- **Voided sales are excluded from credit.** Phase 5 will set `voidedAt`; every customer query
  already filters `voidedAt: null` so a future void cannot leave a phantom balance.
- **WhatsApp statements are plain text built from derived data.** `buildStatementText` formats
  the shop name, balance, and five most recent entries; the detail page opens a `wa.me` link
  with the text encoded. No messaging API, no stored message.
- **The header keeps two rows on a phone.** The brand sits on its own row and the nav row
  scrolls horizontally when six links do not fit, so adding Reports did not create a third
  row. The page itself never scrolls horizontally, per `ui-context.md`.
- **Native `<select>` for the customer choice.** Consistent with the Phase 2 decision: it
  submits through `FormData` and keeps working without JavaScript.
- **Duplicate cart lines are merged server-side.** The stock check runs once per product, so
  two lines of the same item cannot each pass separately and oversell.
- **Revenue is recognised at sale time (accrual).** A non-voided sale counts in revenue and
  profit on the day it is recorded, including the unpaid part of a credit sale. Repayments
  settle an existing sale and never add revenue; outstanding khata is reported separately.
  This matches success criterion 6, which compares totals with the underlying sale records.
- **Per-product revenue is before the sale-level discount.** A discount applies to the whole
  sale and is not allocated across lines, which would introduce rounding. The report labels
  line sales as "before discounts"; the summary subtracts discounts so the totals reconcile.
- **Best sellers rank by line sales; slow movers are active, stocked products with no sales in
  the period.** Ranking by quantity would compare kilograms with pieces. Slow movers are
  ordered by the cost value of the stock sitting still.
- **"This month" and "this year" are month-to-date and year-to-date.** The range ends at the
  start of tomorrow, so charts do not show empty future days. Custom ranges include both
  chosen days.
- **The dashboard chart is server-rendered markup, not Recharts.** A 14-day bar chart needs no
  client JavaScript, no extra dependency, and no hydration cost on a cheap phone. Recharts
  stays listed in the stack for a future chart that genuinely needs interaction; if it is
  added, the reason must be recorded here.
- **Report date ranges are validated with Zod.** Search params are external input; impossible
  dates such as 31 February and inverted ranges are rejected with a readable message and a
  month fallback.
- **Expenses are append-only and dated at shop-local midnight.** No edit or delete; a correction
  is a new expense. Net profit is gross profit minus expenses in the same report range.
- **Voiding is a reversal, not an edit.** A void requires a reason, restores every line with a
  `VOID` stock movement, sets `voidedAt` / `voidedReason`, and writes the audit row in the same
  transaction. A credit sale with repayments applied is refused because the derived khata
  balance would go negative; a refund record is a future decision. No actor beyond `local` is
  recorded until sign-in exists.
- **The audit log is written in the change's transaction.** It records actor, action, entity
  type/id, summary, and before/after JSON. The actor is the single local user (`local`) until
  Auth.js is scheduled; it is not authenticated attribution yet. The audit page shows the
  before/after state so a shopkeeper can see what changed.
- **Expected cash is cash sales + counter cash on credit sales + repayments − expenses.**
  Voided sales are excluded and expenses are assumed paid from the drawer. A cash check is a
  per-shop-day snapshot: a later void changes the live breakdown but never rewrites a saved
  check.
- **Backups use SQLite's online backup API, not a raw file copy.** `better-sqlite3` is a direct
  dependency because it was already the Prisma adapter driver and exposes the online backup
  call. The dashboard and `/backups` make one daily backup per shop day; the last 30 daily files
  are kept and manual backups are kept until deleted. Restore is a documented file copy with
  the app stopped, verified by opening a backup and reading its tables.
- **Audit and backup infrastructure live in `src/lib`; cash reconciliation is a domain.**
  Audit is cross-domain infrastructure and backup is filesystem infrastructure, so neither
  belongs in a single feature module. Cash reconciliation has its own schema, service, and
  queries under `src/modules/cash`.
- **The reports summary has six cards.** Sales, revenue, gross profit, expenses, net profit, and
  credit given. The dashboard keeps its four today cards and adds expenses and net profit to the
  month strip, so the landing screen stays scannable.
- **`/more` groups the less frequent tools.** Expenses, Day close, Backups, and Audit log sit
  behind one nav link instead of making the phone header longer.

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
- Phase 3 was rebuilt from the Phase 2 base `9674905` rather than patching the first attempt.
  The first attempt is preserved on `backup/phase3-first-attempt` (`061e1d8`) on GitHub. Its
  migration `20261025104027_add_customers_and_credit` was reversed in `prisma/dev.db` (tables
  dropped, `sales` rebuilt without `customerId`, migration row deleted) with the product and
  its opening movement preserved. The rebuild uses `20261026062624_add_customers_and_credit`.
- Two browser bugs from the first attempt were fixed in the rebuild: the header overflowed on
  360–414px phones, and the customer dropdown on `/sell` stayed stale after a customer was
  created in another tab.
- The Phase 3 HTTP verification used a copy of `prisma/dev.db`. The later phone check created
  `ali khan` and credit sale `20261026-0001` in the real database, and that data was left in
  place.
- Phase 4 added no schema change, so no migration was created and the dev server did not need
  a Prisma restart for new models.
- The Phase 4 HTTP verification used a copy of `prisma/dev.db` (`/tmp/opencode/`), so the real
  database was only read. The dashboard currently shows the Phase 3 phone-check sale.
- `dateKeyInKarachi` returns `YYYYMMDD` for sale numbers; report date inputs need
  `YYYY-MM-DD`, so `isoDateKeyInKarachi` was added. Mixing the two produced an "Enter a valid
  end date" failure during the first test run.
- `Intl.DateTimeFormat` with `hourCycle: "h23"` is the source of the Karachi offset. The
  conversion applies the offset twice so it would still settle if the zone ever observed DST.
- The header nav scrolls horizontally on very narrow phones. This keeps the brand and nav on
  two rows instead of three now that Reports is a sixth link.
- Final browser check is done on a phone over the LAN URL printed by `npm run dev` (for
  example `http://192.168.1.17:3000`); the address changes with the network.
- Phase 5 added two migrations: `20261026184011_add_expenses_audit_and_cash_reconciliation`
  and `20261026185725_add_audit_actor_and_state`. The second was added after noticing that
  invariant 7 requires an actor and before/after values; the first version of `AuditLog` only
  had `details`. Both are applied to `prisma/dev.db`, and the client was regenerated.
- The audit page on the real database is empty until a new money or stock change is made,
  because the Phase 3 data predates the audit log. The Phase 5 verification used a copy of a
  daily backup, so it did not add demo expenses or a voided sale to the shop's real data.
- The Phase 5 mutation check recorded an expense, a cash sale, a cash check, a void, and a
  manual backup on the copy. It confirmed stock restoration, the saved check staying at its
  original snapshot, the live expected cash excluding the voided sale, net profit, four audit
  rows with before/after, and a readable backup file.
- The dashboard and `/backups` created `daily-20261026-234819498.db` and
  `daily-20261027-001026096.db` in `backups/` during the page checks. `backups/` is ignored by
  git.
- The dev server's LAN address changed to `http://192.168.1.105:3000` during this session. It
  is printed at start-up and changes with the network.
- `better-sqlite3` was already present as the Prisma driver; adding it as a direct dependency
  makes the online backup API explicit. `@types/better-sqlite3` is pinned separately and may
  lag the runtime version, but the backup calls typecheck.
- Turbopack warned that `path.resolve(process.cwd(), raw)` traced the whole project. The
  database path is dynamic, so the call is marked `/*turbopackIgnore: true*/`; the warning is
  gone and the build output is smaller.
- The void guard blocks a credit sale once any repayment is applied. The UI message now says
  refunds are not supported yet, and the gap is listed under Open Questions rather than
  pretending the shopkeeper can settle it in the app.
