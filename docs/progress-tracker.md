# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 7 — Assistant proposals: **Complete** (sales, expenses, khata repayments, customer
  creation, product creation, product edits, and stock adjustments)

## Current Goal

- Nothing in progress. Phase 7.2 customer, product, and stock proposals are complete and
  verified locally. The assistant can prepare a signed sale, expense, khata repayment,
  customer, new product, product edit, or stock adjustment; only the signed-in shopkeeper can
  confirm it. Next is Phase 8 — Pashto support, unless the owner first asks to extend Phase 7
  further, for example customer edits or product activation.
- Phase 7.2 customer, product, and stock proposals are complete and
  verified locally. The assistant can prepare a signed sale, expense,
  khata repayment, customer, new product, product edit, or stock
  adjustment; only the signed-in shopkeeper can confirm it.

  All PRs in the stack are now merged into `main`:
  - PR #1: sale proposals (Phase 7)
  - PR #2: expense and payment proposals (Phase 7.1)
  - PR #3: customer, product, and stock proposals (Phase 7.2)
  - PR #4: Pashto support (Phase 8)

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
  (the signed-in username since Phase 5.5; Phase 5 rows use `local`), action, entity type/id,
  summary, and before/after JSON. A failed transaction leaves neither the change nor its audit
  row.
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

### Phase 5.5 — Sign-in (Auth.js) (complete)

- Migration `20261028020154_add_users_and_auth` adds the `User` model: unique lowercased
  `username`, optional `name`, bcrypt `passwordHash`, `role` (`OWNER` | `CASHIER`), and
  `tokenVersion`. The real `prisma/dev.db` has the migration applied and the single owner
  seeded. Phase 10 adds `CUSTOMER` and `customerId` (migration
  `20261102000000_add_customer_user_role`).
- `src/lib/credentials.ts` — Zod `loginSchema` and `ownerSchema`, `verifyCredentials` (the
  same null result for an unknown user or a wrong password), and `ensureOwner`. The owner
  seed is idempotent; changing `OWNER_PASSWORD` updates the hash and increments
  `tokenVersion`, which invalidates existing sessions.
- `src/lib/auth.ts` — Auth.js v5 Credentials provider, JWT sessions (8-hour lifetime, 1-hour
  refresh), `trustHost` for LAN access, a same-origin redirect callback, and a JWT callback
  that re-reads the user so a deleted user or changed `tokenVersion` signs out. `AUTH_SECRET`
  is required and the `.env.example` placeholder is rejected.
- `src/proxy.ts` — Next.js 16 renamed `middleware.ts` to `proxy.ts`; it protects every route
  except `/login`, `/api/auth`, and static assets, and redirects to `/login?from=...`.
- `/login` — username/password card, inline field and credential errors, pending state, and
  a safe redirect back to `from`. The header shows the signed-in username and a sign-out
  button on every protected page; sign-out clears the session and returns to `/login`.
- Audit attribution is real: every server action calls `requireUser()` and passes
  `session.user.username` to the service. Service functions accept an optional actor and
  default to `local` for tests and seed data. Invariant 7 now records the signed-in user.
- `.env.example` and the README document `AUTH_SECRET`, `OWNER_USERNAME`, `OWNER_PASSWORD`,
  and `OWNER_NAME`. The owner password is changed by editing `.env` and running
  `npm run db:seed`; there is no in-app password screen yet.
- Tests: 123 passing across 14 files. New tests cover owner creation/hashing, seed
  idempotency, password changes and `tokenVersion`, username normalization, malformed and
  unknown credentials, and the audit actor.
- Verified against the running app: unauthenticated `/` redirects to `/login?from=%2F`; a
  wrong password leaves the session null; the owner signs in and sees the dashboard with
  `owner` and **Sign out**; sign-out returns the session to null; bumping `tokenVersion`
  rejects the old cookie and a fresh sign-in works. `npm run typecheck`, `npm run lint`,
  `npm test`, and `npm run build` pass.

### Phase 6 — Assistant (read-only) (complete)

- No schema change and no migration: chat history is client state, not stored.
- `src/lib/ai/` — provider-agnostic types, an OpenAI-compatible `/chat/completions` adapter
  (`fetch`, no vendor SDK), and config (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`,
  `isAssistantConfigured()`).
- `src/modules/assistant/` — `schema.ts` (question, history, and range validation),
  `range.ts` (today, yesterday, this month, last month, this year, custom), `tools.ts`
  (11 read-only tools with Zod schemas converted by `z.toJSONSchema`), and `service.ts`
  (system prompt, history, at most four model rounds and eight tool calls).
- Tools: sales summary, top products, product sales, low stock, outstanding credit, customer
  balance, inventory value, slow moving, recent sales, expenses by category, and expected
  cash. Unknown tools and invalid arguments are rejected before execution.
- `src/modules/expenses/queries.ts` — `expenseSummaryByCategory` for the expenses tool.
- `/assistant` — read-only badge, suggestions, transcript, "Checked:" tool labels, pending
  state, and readable errors. Reachable from the dashboard **Ask assistant** button and the
  **More** page. The main navigation is unchanged.
- A setup notice appears when the provider is unconfigured and the rest of the app works.
  The privacy note explains that the question and needed figures go to the provider; a local
  Ollama model is documented.
- The server action calls `requireUser()` and re-validates with Zod; it performs no writes and
  no `revalidatePath`.
- `.env.example` and the README document the optional assistant configuration.
- Configured against Google Gemini's OpenAI-compatible endpoint with `gemini-3.5-flash-lite`
  (values live in the gitignored `.env`). The adapter round-trips Gemini's `thought_signature`
  tool-call metadata, which the endpoint requires on the next model turn; without it Gemini
  returns HTTP 400.
- Tests: 154 passing across 18 files. New tests cover ranges, every tool, the tool guard,
  service orchestration with a fake provider, history, round limits, and the adapter's
  request, response, error handling, and provider-specific tool-call metadata.
- Verified: the unconfigured `/assistant` renders the setup notice; the configured page
  renders the chat; the service and adapter loop answered a real question against a mock
  OpenAI-compatible server and the dev database. `npm run typecheck`, `npm run lint`,
  `npm test`, and `npm run build` pass.

### Phase 7 — Assistant sale proposals (complete)

- One schema change: `Sale.proposalId` (`String? @unique`), migration
  `20261028120000_add_sale_proposal_id`. Ordinary sell-screen sales leave it null; a confirmed
  proposal stores its id so a replay cannot create a second sale.
- `src/modules/sales/pricing.ts` — shared `priceSale` reads products and customers, merges
  duplicate lines, validates stock, discount, and cash/credit rules, and returns the exact
  lines, totals, and snapshots. `createSale` now uses it, so the sell screen and a proposal
  cannot drift. `toSalePreview` and `matchesSalePreview` compare the shopkeeper-facing
  preview.
- `src/modules/sales/service.ts` — `createSaleWithStatus` supports `proposalId` and
  `expectedPreview`, returns `alreadyConfirmed`, and handles a concurrent unique-proposal
  conflict. `createSale` keeps its original contract for the sell screen.
- `src/modules/assistant/sale-proposal.ts` — `propose_sale`, separate from the read-only
  registry. Resolves product names/aliases/barcodes and customer names/phones, prices the
  draft, and returns a signed proposal plus a model-facing summary. It never writes.
- `src/modules/assistant/proposal-token.ts` and `proposal-schema.ts` — HMAC-SHA256 token
  derived from `AUTH_SECRET`, bound to the user id, 15-minute expiry, signed draft and preview.
- `src/modules/assistant/confirm-sale.ts` — verifies the token and calls
  `createSaleWithStatus` with the signed proposal id and preview.
- `src/app/assistant/actions.ts` — `confirmSaleProposalAction` calls `requireUser()`, verifies
  the token, writes through the sale service, and revalidates `/`, `/sell`, `/products`,
  `/sales`, and `/customers`. `askAssistantAction` is still read-only and passes the user id.
- `src/components/assistant/sale-proposal-card.tsx` — "Proposed sale — not saved yet" card
  with lines, totals, payment/customer, expiry, **Confirm sale**, **Dismiss**, pending/error
  states, and a receipt link on success. The chat renders it under the answer.
- `/assistant` badge and copy now say "Read-only · confirm to save"; the empty state mentions
  proposals. The read-only registry in `tools.ts` is unchanged.
- Tests: 175 passing across 21 files. New tests cover token signing/tamper/expiry/wrong user,
  proposal resolution (name, alias, barcode, customer phone, ambiguity, unknown, stock),
  confirmation (write, audit actor, replay idempotency, stale price/stock, wrong user,
  expiry, tamper, credit khata), and the assistant service capturing a proposal without
  writing or exposing the token to the model.
- Verified end to end with the real Gemini provider: "Sell 1 piece of Dove Shampo for cash."
  returned a proposal for Rs. 400.00 and did not write. A live run against the disposable test
  database confirmed a Rs. 25.00 sale for a seeded item: stock 5 → 4, audit actor
  `live-owner`, `details.source = "assistant_proposal"`. `npm run typecheck`, `npm run lint`,
  `npm test`, and `npm run build` pass.

### Phase 7.1 — Assistant expense and payment proposals (complete)

- One additive schema change: `Expense.proposalId` and `Payment.proposalId`, both
  `String? @unique`, migration `20261029120000_add_expense_payment_proposal_id`. Ordinary
  expense-screen and customer-screen entries leave them null; a confirmed proposal stores its
  id so a replay cannot duplicate the expense or credit the khata twice.
- `src/modules/assistant/proposal-token-core.ts` — shared HMAC-SHA256 signing, 15-minute
  metadata, and verification for every proposal. Each kind uses a purpose-specific key derived
  from `AUTH_SECRET`, so a sale token cannot be replayed as an expense or payment.
- `src/modules/assistant/proposal-token.ts` — `createSaleProposalToken` and
  `verifySaleProposalToken` now wrap the shared core; added the expense and payment wrappers.
- `src/modules/assistant/proposal-schema.ts` — signed sale, expense, and payment payloads plus
  the `AssistantProposal` union the chat renders.
- `src/modules/assistant/resolve.ts` — shared customer name/phone matching and
  `ProposalToolContext`; `sale-proposal.ts` now uses it.
- `src/modules/assistant/expense-proposal.ts` — `propose_expense` resolves category aliases,
  amount, note, and a shop date defaulting to today. It signs the draft and preview but never
  writes.
- `src/modules/assistant/payment-proposal.ts` — `propose_payment` resolves an existing
  customer, reads the derived outstanding balance, rejects zero/overpayment, and signs the
  preview with `balanceBeforePaisa` and `balanceAfterPaisa`. It never writes.
- `src/modules/assistant/proposal-tools.ts` — registers `propose_sale`, `propose_expense`, and
  `propose_payment`, exposes the definitions to the service, and enforces one proposal per
  answer.
- `src/modules/assistant/service.ts` — the answer now carries `AssistantProposal`; the system
  prompt explains all three proposal tools and still forbids direct writes. The one-proposal
  guard applies across kinds.
- `src/modules/expenses/preview.ts` and `src/modules/customers/preview.ts` — signed preview
  schemas and comparison helpers.
- `src/modules/expenses/service.ts` — `createExpenseWithStatus` supports `proposalId` and
  `expectedPreview`, returns `alreadyConfirmed`, handles a concurrent unique conflict, and
  records `details.source = "assistant_proposal"` plus the proposal id. `createExpense` keeps
  its original contract.
- `src/modules/customers/service.ts` — `recordPaymentWithStatus` supports `proposalId` and
  `expectedPreview`, re-reads the khata balance inside the transaction, rejects a stale
  balance or overpayment, checks replay before the balance check, and records the audit source
  and proposal id. `recordPayment` keeps its original contract.
- `src/modules/assistant/confirm-expense.ts` and `confirm-payment.ts` — verify the signed
  token and call the corresponding service with the signed draft, preview, and proposal id.
- `src/app/assistant/actions.ts` — added `confirmExpenseProposalAction` and
  `confirmPaymentProposalAction`, both calling `requireUser()` and revalidating the affected
  paths. The shared token guard rejects empty or oversized tokens.
- `src/components/assistant/expense-proposal-card.tsx`,
  `payment-proposal-card.tsx`, and `proposal-card.tsx` — warning-tinted confirmation cards for
  each kind, with expiry, details, **Confirm**/**Dismiss**, pending/error states, and a success
  panel with a link to the record. The chat renders the union through `ProposalCard`.
- `/assistant` copy and suggestions now mention preparing an expense and a khata payment.
- Tests: 190 passing across 23 files. New tests cover expense/payment token binding, preview
  building, category/date validation, customer resolution, no-balance and overpayment
  rejection, confirmation, audit actor/source, replay idempotency, stale-balance rejection, and
  the one-proposal-per-answer rule.
- Verified end to end with the real Gemini provider against the disposable test database:
  "Record 500 rupees electricity expense for today." prepared an expense proposal and wrote
  nothing; confirmation wrote Rs. 500.00 with actor `live-owner` and
  `details.source = "assistant_proposal"`. "Live Ali paid 120 rupees on his khata." prepared a
  payment proposal with a Rs. 320.00 balance before and Rs. 200.00 after; confirmation wrote
  Rs. 120.00 and left the derived balance at Rs. 200.00. `npm run typecheck`, `npm run lint`,
  `npm test`, and `npm run build` pass.

### Phase 7.2 — Assistant customer, product, and stock proposals (complete)

- One additive schema change: `Customer.proposalId`, `Product.proposalId`,
  `StockMovement.proposalId`, and `AuditLog.proposalId`, all `String? @unique`, migration
  `20261029160000_add_customer_product_stock_proposal_id`. Customer creation, product creation,
  and stock adjustments use the row-level id for idempotency. Product edits update an existing
  row, so the audit row is their idempotency record. Ordinary screen entries leave every
  proposal id null.
- `src/modules/customers/preview.ts` and `src/modules/products/preview.ts` — signed preview
  schemas and comparison helpers for customer creation, product creation, product edits, and
  stock adjustments. Product edit previews contain both the before and after snapshots; stock
  previews contain the stock before, signed delta, and stock after.
- `src/modules/customers/service.ts` — `createCustomerWithStatus` supports `proposalId` and
  `expectedPreview`, writes the customer and audit row in one transaction, returns
  `alreadyConfirmed`, and handles a concurrent unique conflict. `createCustomer` keeps its
  original contract.
- `src/modules/products/service.ts` — `createProductWithStatus`, `updateProductWithStatus`, and
  `adjustStockWithStatus` support `proposalId` and `expectedPreview`, return
  `alreadyConfirmed`, and handle a concurrent unique conflict. Product creation still writes
  the OPENING movement in the same transaction. Product edits compare the signed before-state
  with the current row and reject a stale proposal. Stock adjustments re-read the current stock
  and reject a stale preview or a below-zero result. `createProduct`, `updateProduct`, and
  `adjustStock` keep their original contracts.
- `src/modules/assistant/customer-proposal.ts`, `product-proposal.ts`,
  `product-update-proposal.ts`, and `stock-adjustment-proposal.ts` — `propose_customer`,
  `propose_product`, `propose_product_update`, and `propose_stock_adjustment`. They resolve
  names, aliases, barcodes, units, and stock reasons; validate against the same Zod schemas as
  the screens; reject duplicates and below-zero stock; sign the draft and preview; and never
  write.
- `src/modules/assistant/proposal-schema.ts` and `proposal-token.ts` — signed payloads and
  purpose-specific token wrappers for the four new kinds. `AssistantProposal` now covers seven
  proposal kinds; the one-proposal-per-answer rule applies across all of them.
- `src/modules/assistant/confirm-customer.ts`, `confirm-product.ts`,
  `confirm-product-update.ts`, and `confirm-stock-adjustment.ts` — verify the token and call the
  corresponding service with the signed draft, preview, and proposal id.
- `src/app/assistant/actions.ts` — added the four confirmation actions, each calling
  `requireUser()` and revalidating the affected paths.
- `src/components/assistant/customer-proposal-card.tsx`,
  `product-proposal-card.tsx`, `product-update-proposal-card.tsx`, and
  `stock-adjustment-proposal-card.tsx` — warning-tinted cards with expiry, before/after values,
  **Confirm**/**Dismiss**, pending/error states, and a success panel with a link to the record.
  `proposal-card.tsx` renders all seven kinds.
- `src/lib/audit.ts` — `writeAudit` accepts an optional `proposalId`; the audit row stores it in
  a unique column when it is the idempotency record for a product edit.
- Tests: 200 passing across 24 files. New tests cover the registry, customer creation and
  duplicate rejection, product creation with opening stock, product edits with stale rejection
  and replay, stock adjustments with stale/below-zero rejection and replay, audit source and
  actor, and proposal id storage.
- Verified locally with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
  The new cards have not yet been clicked in a browser; the service and action paths are
  covered by the tests.

### Phase 8 — Pashto support (complete)

- No schema change and no migration: locale, fonts, and translations are additive.
- `src/lib/i18n.ts` — cookie-based `shop_locale` locale (`en`/`ps`), `getLocale()`,
  `getDirection()`, and `t()` translation helper; server-only cookie reads.
- `src/lib/dictionary.ts` — pure translation dictionaries (`en`/`ps`), client-safe
  `translate()` helper, `readClientLocale()`.
- `src/lib/text.ts` — Unicode text normalization: NFKC, ZWNJ/tatweel/diacritic stripping,
  Arabic/Pashto character folding (ي/ی, ك/ک, ہ/ه), Arabic-Indic digit conversion, lowercasing.
- `src/app/layout.tsx` — `lang`/`dir` on root `html`, Noto Naskh Arabic font for Pashto,
  `LocaleSwitcher` client component.
- `src/components/locale-switcher.tsx` + `src/app/locale/action.ts` — English/Pashto
  language switcher; server action sets the `shop_locale` cookie.
- Translated shell, navigation, page headings, buttons, labels, assistant copy, and all
  seven proposal cards; English fallback for unverified Pashto strings.
- Bidi-safe inputs: `dir="auto"` for names/notes/search; `dir="ltr"` for money/quantity/
  phone/barcode.
- Tests: 200 passing across 24 files. `npm run typecheck`, `npm run lint`, `npm test`, and
  `npm run build` pass.

### Phase 9 — Voice input (complete)

- `src/lib/speech.ts` — Web Speech API wrapper: start/stop listening, locale, listening
  state, support check.
- Microphone button on `/assistant`; transcript feeds into `askAssistantAction`.
- Recognition language follows locale: `ps-PK` for Pashto, `en-US` for English.
- Voice proposals still require explicit shopkeeper confirmation.

### Phase 10 — Customer accounts (complete)

- Migration `20261102000000_add_customer_user_role` adds `CUSTOMER` to the `User.role` values
  and a nullable, unique `User.customerId` foreign key to `Customer` (`ON DELETE CASCADE`).
  The migration rebuilds the SQLite `users` table because SQLite cannot alter a column.
- `src/lib/credentials.ts` — `customerRegistrationSchema` (name, phone, password, optional
  customerId) and `customerId` on the `AuthUser`/session types.
- `src/modules/customers/service.ts` — `createCustomerAccount` creates a `Customer` and a
  `User` (role `CUSTOMER`) in one transaction; `createAccountForCustomer` is the
  shopkeeper-side helper that requires the customer to have a phone number. Both write an
  audit row (`CUSTOMER_ACCOUNT_CREATED`).
- `src/app/customers/sign-up/` — public self-registration page; on success the customer is
  signed in and sent to `/customers/khata`.
- `src/app/customers/khata/page.tsx` — customer-only view: outstanding balance, credit sales
  (receipt number, date, amount, amount paid) and repayments (date, amount, note), reusing
  `customerBalancePaisa` and `customerHistory`.
- `src/app/customers/[id]/page.tsx` + `src/components/customers/customer-account-form.tsx` —
  shopkeeper creates an account for an existing customer; the phone number is the username.
- `src/lib/require-user.ts` — `requireOwner()`; all shopkeeper server actions use it instead of
  `requireUser()`.
- `src/proxy.ts` — role-aware redirects: `CUSTOMER` may only reach `/customers/khata`;
  shopkeeper-only users are redirected away from it. `/customers/sign-up` is public.
- `src/app/layout.tsx` — shop navigation is hidden for `CUSTOMER` users and the brand links to
  their khata.
- Tests: `tests/customer-accounts.test.ts` covers self-registration, login as a customer,
  duplicate phone rejection, linking to an existing customer, the shopkeeper path, and the
  missing-phone case. 217 tests pass across 26 files.

### Phase 11 — Camera alerts (complete)

- Owner decisions (recorded 2026-11-04):
  - Camera source: the laptop webcam (built-in or USB) today; a separate/IP camera may
    replace it later, so the capture design reads a configurable device rather than
    hard-coding one.
  - Detection: motion-based clips — record a short clip when motion is detected. No
    accusation, no face recognition; clips exist for human review.
  - Review UX: an owner-only `/alerts` page listing clips by time with mark-reviewed and
    dismiss actions.
- Confirms the architecture: the camera is a separate Python + OpenCV process under
  `services/camera/`, communicating with the app over a local HTTP endpoint authenticated
  with a shared secret; it holds no business data of its own. Clip metadata lives in SQLite;
  video bytes live on disk in `media/camera/` (git-ignored).
- Slices: 11.0 docs → 11.1 app-side intake/storage/review UI → 11.2 camera process →
  11.3 QA. All complete.
- End-to-end verified on 2026-11-04: the service opened the laptop webcam (`/dev/video0`),
  detected motion, wrote `clip-*.mp4` (H.264 via ffmpeg), and the app accepted the alert;
  the clip streamed to the owner session on `/alerts`. Customer and anonymous requests are
  rejected (403/401), and the intake route rejects missing or wrong tokens (401).
- The service supports `CAMERA_DEVICE=selftest` (synthetic moving shape) so the shopkeeper
  can verify the whole pipeline without a camera or a person in the room.
- Still open: real-browser QA of `/alerts` at 360px on the phone, and a real overnight run
  to tune the motion threshold and cooldown.

### Phase 12 — Face recognition research spike (complete)

- Owner decisions (recorded 2026-11-04):
  - Goal: a research spike first — a local pipeline (detect face, compute embedding, match
    against enrolled faces) with an honest evaluation of how well it works on this laptop.
    No product UI, no alert integration, no counter identification in this phase.
  - Consent: the intended product direction is shopkeeper-enrolls-with-consent (a visible
    consent step on the customer detail page). For the spike itself, only the owner's and
    any consenting staff faces are enrolled.
  - Biometric data: store the numeric embedding plus the reference photo so match quality
    can be checked; both are deletable on request, and deletion must actually work before
    the spike ends. Embeddings are not reversible to a photo; photos never leave the laptop.
- Confirms the architecture: face processing lives in a separate process under
  `services/face/`, like the camera service — the Next.js app never runs models. Everything
  runs offline (no cloud face APIs); model files are downloaded once and kept locally.
- Slices: 12.0 docs → 12.1 prototype → 12.2 evaluation → 12.3 findings and go/no-go.
  All complete.
- Verified on 2026-11-04 (single consenting subject, the owner): enrollment, probe matches
  at 0.894 / 0.785 / 0.794 cosine similarity against the 0.363 boundary (all strong
  MATCHes, dim light, ~1 m), ~1.2 s per match, and deletion that removes both the
  embedding and the reference photo. Findings and the go/no-go recommendation are in
  `docs/face-recognition-findings.md`.
- Key limitation recorded: the same-person vs different-person score gap was not measured
  (one subject only) — any product feature must start with a multi-subject evaluation.
- One consent event: the owner consented in-session to three webcam captures for the
  spike; enrollment remains in place under `services/face/data/` (git-ignored) and can be
  removed any time with `spike.py delete attaullah`.

### Post-phase unit — Settings and password change (complete)

- Owner request (2026-11-05): a settings option in a suitable place, with a change-password
  option, and the owner password rotated to a shorter one.
- Built: `/settings` page (linked from the header menu) showing the signed-in account and
  a change-password form (current password, new password, confirm). Business logic in
  `src/modules/settings/`: verifies the current password, enforces the same 8-character
  minimum as sign-up, rejects reuse of the current password, bcrypt-hashes, increments
  `tokenVersion`, and writes a `PASSWORD_CHANGED` audit row — all in one transaction.
- Changing the password signs out every device including the one that changed it; the user
  lands on `/login?changed=1` with a confirmation flash. Customer password change/reset
  remains a later decision.
- Verified over HTTP: owner sees the page (200), customer is redirected to the khata view,
  anonymous to login; the no-JS form path changed the password for real (tokenVersion
  bumped, audit row written, old session invalidated); the login flash renders. 5 service
  tests added (230 total).
- The owner password was rotated twice during verification (via the real form action and
  back); the live password is the `OWNER_PASSWORD` value in `.env`.
- Follow-up (2026-11-06, owner request): the floating Next.js dev-tools badge is disabled
  (`devIndicators: false`); a hamburger settings menu sits at the top-left of the header
  (owner and customer) opening Account, Security, Change password, and About links; the
  settings page gained role-aware Account details, a "Sign out everywhere" action
  (`tokenVersion` bump + audit, tested), and an About section; the Settings card was
  removed from More; customers may now open `/settings` (proxy allowlist updated) while
  still being blocked from shop pages. Email was deliberately not added: nothing in the
  offline app can use it. Verified over HTTP for both roles.
- Follow-up (2026-11-06): the section bar marks the current section — brand-tinted pill,
  brand text, an icon, and `aria-current="page"` — and every item gained a Lucide icon. The
  bar is now a client component (`src/components/nav-bar.tsx`) because the active state needs
  `usePathname()`. Nested pages keep their parent lit (`/customers/<id>` → Customers) and the
  More tools (assistant, expenses, day close, alerts, backups, audit) light More. Verified
  over HTTP on every section, a real sale and customer detail page, and the More tools.
- Regression found and fixed during that verification: `/expenses` and `/day-close` returned
  500 since the i18n commit because the pages passed `t`/`categoryT` functions as props to
  client components, which Next.js forbids. Both forms now read the locale themselves with
  `readClientLocale()`/`translate()` (the same pattern as the alert review form); the pages
  render 200 again. This was invisible to the service tests and to the production build.
- Follow-up (2026-11-06, owner request): the shop logo is now used as an SVG asset — the B1
  Spine-E app tile from the logo work (`logo/easyshop/concepts/b1-spine-e-tile.svg`), copied to
  `public/logo.svg`, with `src/app/icon.svg` as the favicon (the default `favicon.ico`
  removed). The header brand and the sign-in card show the logo beside the "AI Shopkeeper"
  wordmark (28px and 32px). Verified over HTTP: `/logo.svg` and `/icon.svg` serve with the right
  content type, both pages embed the image, and the favicon link is emitted.
- The logo exploration assets (`logo/`, 480 KB — six archived concepts plus the three EasyShop
  Book-E variants, lockups, previews, and `preview.html`) are committed so the work is
  preserved. The EasyShop rename is still a separate, unstarted unit.
- Follow-up (2026-11-07, owner request): the theme moved to a **white base** — page and cards
  are both white (`--bg-base`), separated by the hairline border plus a soft `--card-shadow`
  (applied automatically to the standard `rounded-xl border border-line bg-surface` card).
  Added two accent colours: a **money amber** (`--accent-money` `#B45309`) for the sell
  screen's Complete sale / Record credit sale CTA and mobile total and for the revenue stat
  card's top accent, and a **mint tint** (`--bg-tint` / `--accent-soft` `#ECFDF5`) for the
  active nav pill and the More card hover. Stat cards gained a tone-coloured top accent bar;
  the sign-in card gained a teal top border; chart tokens were retuned (teal, amber, mint,
  slate, ink). All AA contrast checks pass. Verified over HTTP: dashboard accents
  (money/brand/brand/error), both sell CTAs, the More hover, and the login border.
- Test infrastructure: the default Vitest timeout was raised from 5s to 15s. bcrypt hashing
  was exceeding 5s whenever the laptop was loaded (dev server + browser + another session),
  making `tests/auth.test.ts` and `tests/settings.test.ts` flake; with 15s the full suite
  passes reliably (232/232) under load.
- Follow-up (2026-11-06, owner request): the shop name moved out of the nav cluster to the
  inline start (top-left) of the header. Desktop order is now brand, section bar, then the
  settings menu, locale switcher, and signed-in user; on mobile the actions sit to the right
  of the brand and the section bar keeps its own full-width row. `docs/ui-context.md` was
  updated to match.

## Current Phase

- Post-phase unit — Settings and password change: **Complete** (`/settings` page with
  Account, Security, and About sections; header hamburger menu; owner password rotated to
  the value in `.env`). Section bar active state: **Complete**. White-base palette with teal
  + money amber + mint accents: **Complete**.

## Current Goal

- Phase 0 through Phase 12 are complete on `main`, plus the settings unit. Remaining work
  is polish (real-browser QA at 360px, Pashto review, overnight camera tuning) or new
  decisions (the Phase 12 follow-up feature, multi-shop v2, cashier role).
- Build nothing outside this scope without an owner decision first.

## Next Up

- Real-browser QA at 360px on the phone (in progress): owner sign-in now uses the new
  password from `.env`; every device was signed out by the rotation, so sign in again.
- Optional: Pashto speaker review of the dictionary strings; overnight camera run to tune
  the motion threshold and cooldown.
- The Phase 12 recommendation is GO for a hint-only feature after a multi-subject
  evaluation — that future feature is a new decision for the owner, not part of any
  current phase.

## Open Questions

- Locale storage: per-browser cookie (`shop_locale`), or a shop-wide database setting? Cookie
  is recommended — no migration, survives across tabs/devices only per browser.
- Numbers and currency: keep Latin digits and `Rs.` in both locales, or use Pashto digits and
  `روپۍ`? Recommendation: keep Latin digits and `Rs.` so reconciliation and parsing stay
  simple; Pashto labels surround them.
- Error localization: fully Pashto server/validation errors, or accept English fallbacks for
  now? Recommendation: typed error codes translated at the UI boundary.
- Pashto dialect and reviewer: standard, Kandahari, or Peshawari — and who reviews the
  translations?
- Should `matchCustomer`/`matchProduct` normalization fold Arabic/Pashto character variants
  (ي/ی, ك/ک, ZWNJ) and convert Pashto digits before matching?

- Will the shop use a thermal receipt printer? If yes, which model and connection (USB,
  network, Bluetooth)? Needed before receipt printing is scheduled.
- Will a barcode scanner be used? This decides whether barcode entry needs keyboard-wedge
  handling or a camera-based scanner.
- Will a second person (cashier) use the system? This decides how soon roles and per-user
  audit attribution matter.
- Where should backups be stored besides the laptop (external drive, second machine, phone)?
  Local-only backups do not protect against disk failure or theft.
- Should the assistant be available to cashiers when roles are added? Today only the owner
  signs in.
- Should assistant answers be saved for review? Phase 6 deliberately keeps history in the
  browser only; a saved transcript would need a retention and privacy decision.
- Multi-shop / social accounts (post-v1): everyone registers their own shop; customers can
  join a specific shop to track their debt/khata there; account type is decided at account
  creation. This contradicts the current single-tenant, single-shop invariant in
  architecture.md and, when scheduled, would add shopId to every business table, a shop
  registration/login flow, and customer invite/join flows. Capture as a v2 scope item, not a
  v1 change: v1 stays one shop, one laptop.
- Should Phase 7 expand further to customer edits, product activation/deactivation, or customer
  deletion? Each needs its own explicit-confirmation design; the current slice is sales,
  expenses, khata repayments, customer creation, product creation, product edits, and stock
  adjustments.
- Should unconfirmed proposals be persisted for review, or remain signed, short-lived tokens?
  The current choice stores nothing until confirmation; the resulting customer, product, stock
  movement, sale, expense, or payment keeps the proposal id. A product edit keeps it on its
  audit row because the product row is updated in place.
- Should a payment proposal be allowed against a customer with no outstanding balance, for
  example an advance? The current choice rejects it so the derived khata balance never goes
  negative; an advance would need a new record type and reporting rule.
- Is a 15-minute proposal expiry right for a busy counter? A shorter window is safer; a longer
  one is more convenient when a customer steps away.
- Should a stale proposal be rejected (current) or re-priced and shown for a second
  confirmation? Rejecting guarantees the owner gets exactly the preview they saw.
- Should the shop's day be treated as starting at midnight, or does the shopkeeper consider
  the business day to end after closing (for example 2 a.m.)? Affects "today" reporting. The
  current implementation uses midnight.
- Should the owner be able to change their password inside the app? Today the password is
  set by `OWNER_PASSWORD` in `.env` and `npm run db:seed`, which requires access to the
  laptop. A small change-password screen would remove that dependency.
- How should a credit sale with repayments already applied be corrected? The current void
  guard refuses it because removing the unpaid amount would make the derived khata balance
  negative, and there is no refund or payment-reversal record yet. Options: add a refund record
  that reduces the customer's payments, or allow the void and carry a credit balance owed by
  the shop. Until one is chosen, the shopkeeper must correct it outside the app. A cash refund
  for a voided cash sale is also unrecorded: the void removes the sale from expected cash, so
  the refund is handled outside the app.
- How should a customer reset a forgotten password? Today the shopkeeper creates the account
  with a password; there is no reset screen and no email. Options: the shopkeeper can reset it
  from the customer detail page, or the customer re-registers after the shopkeeper removes the
  old account. A shopkeeper-side reset is the likely next step.
- If the shopkeeper changes a customer's phone number, should the customer's login name change
  too? Today the phone is the username and is copied at account creation, so the two can drift.
  Options: keep them independent, or update the username in the same transaction when the phone
  changes.
- Should customers see the shop's other customers, product names on their sales, or only
  totals? The current khata view shows receipt number, date, and amounts, but not line items.
  Line items would expose product prices and margins, so they are deliberately omitted.
- Should customers be able to change their own password or profile inside the app? Out of scope
  for Phase 10.

## Architecture Decisions

- **SQLite instead of PostgreSQL.** The shop runs offline on one laptop with no database
  server to install, operate, or maintain, and a backup is a single file copy. PostgreSQL is
  revisited only if multiple devices or shops must share data.
- **Money stored as integer paisa.** Avoids floating-point rounding errors in every total,
  and removes the need for a decimal type that SQLite does not provide.
- **Auth.js (NextAuth) v5 with the Credentials provider and JWT sessions.** Implemented in
  Phase 5.5. The Credentials provider requires JWT sessions, so sessions are signed cookies
  rather than database rows; a `tokenVersion` field invalidates them after a password change.
  `next-auth@5.0.0-beta.32` is the current v5 release and supports Next 16.
- **Username, not email, is the login identifier.** A single shop does not need email
  verification or password-reset email; the owner account is seeded from `.env`.
- **The proxy is an optimistic gate; server actions enforce the session.** `src/proxy.ts`
  (Next 16's name for middleware) redirects signed-out requests, and every mutation calls
  `requireUser()` before touching data. Phase 10 adds `requireOwner()` for shopkeeper-only
  mutations and role-based proxy redirects: a `CUSTOMER` may only reach `/customers/khata`.
  The proxy also re-reads the user so `tokenVersion` invalidation applies to page reads.
- **The audit actor is the signed-in username.** It is human-readable on `/audit` and stays
  stable for historical rows; services default to `local` outside a request so tests and seed
  code remain simple.
- **Auth configuration and credential rules live in `src/lib`.** Auth is cross-cutting
  infrastructure, not a business domain, so `src/lib/auth.ts` and `src/lib/credentials.ts`
  own it and `src/modules` stays free of Auth.js imports.
- **The owner password is configured in `.env`.** `npm run db:seed` creates or updates the
  owner and increments `tokenVersion` when the password changes. This is a laptop-only
  operation until an in-app password screen is scheduled.
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
  balance would go negative; a refund record is a future decision. Phase 5.5 records the
  signed-in username as the actor.
- **The audit log is written in the change's transaction.** It records actor, action, entity
  type/id, summary, and before/after JSON. Phase 5.5 records the signed-in username; rows
  written before sign-in use `local`. The audit page shows the before/after state so a
  shopkeeper can see what changed.
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

- **The assistant is tool-based, not text-to-SQL.** Read-only questions use a closed list of
  typed tools generated from Zod schemas. Phase 7 adds separate signed proposal tools; the
  model never sees SQL or the database and cannot write directly. Unknown tools and invalid
  arguments are rejected before execution. This keeps the invariants enforceable even when the
  model is wrong.
- **A proposal is signed, short-lived, user-bound, and not persisted.** Each proposal tool
  reads and prices or validates the draft, then signs the draft and preview with a
  purpose-specific HMAC key derived from `AUTH_SECRET`. It is bound to the signed-in user and
  expires after 15 minutes. Nothing is written until the shopkeeper confirms; the resulting
  row stores the proposal id.
- **Confirmation re-checks the preview inside the write transaction.** `createSaleWithStatus`
  shares `priceSale` with the sell screen and compares the current lines and totals with the
  signed preview before writing. `recordPaymentWithStatus` re-reads the derived khata balance
  and rejects a stale balance or overpayment. `createExpenseWithStatus` compares the signed
  draft with the preview. A change produces a readable rejection, so the owner never gets a
  different record from the one they saw.
- **`Sale.proposalId`, `Expense.proposalId`, `Payment.proposalId`, `Customer.proposalId`,
  `Product.proposalId`, and `StockMovement.proposalId` are nullable and unique for
  idempotency.** A replayed confirmation returns the existing row instead of creating a second
  one. Ordinary screen entries leave them null. For payments the idempotency lookup runs before
  the balance check, so a later repayment does not make the original confirmation look stale.
- **A product edit uses its audit row for idempotency.** The product row is updated in place,
  so a unique `AuditLog.proposalId` marks the confirmed edit. The signed preview carries both
  the before and after snapshots; confirmation compares the current product with the signed
  before-state and rejects a stale proposal.
- **The original Phase 7 slice was sales, expenses, and khata repayments; Phase 7.2 adds
  customer creation, product creation, product edits, and stock adjustments.** Customer edits,
  customer deletion, and product activation/deactivation remain out of scope until each has
  its own explicit-confirmation design.
- **The AI provider is an OpenAI-compatible HTTP endpoint, not a vendor SDK.** One adapter in
  `src/lib/ai/openai-compatible.ts` works with OpenAI, OpenRouter, Groq, LM Studio, Ollama,
  and similar services. Configuration is `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`; no
  provider-specific code leaks into the domain modules.
- **Google Gemini is the current configured provider.** It uses the OpenAI-compatible endpoint
  with `gemini-3.5-flash-lite`. Questions and the figures needed to answer them leave the
  laptop. Switching to local Ollama is an `.env` change, not a code change. Gemini returns a
  `thought_signature` with each tool call; the adapter echoes it back because Gemini rejects
  the follow-up model turn without it.
- **The assistant is optional and the rest of the app stays offline-first.** If the endpoint
  is not configured, `/assistant` shows setup instructions and every other screen works. No
  part of the sale, credit, report, backup, or sign-in path calls the provider.
- **Assistant tools reuse the screen queries and pricing.** Sales, credit, stock, expenses, and
  cash tools call the same `src/modules` queries the dashboard and reports use; proposals and
  the sell screen share `priceSale`. The assistant cannot drift into a second set of reporting
  or pricing rules.
- **The assistant has no chat persistence.** History is client state for the open page, capped
  at six turns. There is no chat table and no transcript on disk. Phase 7 adds only nullable,
  unique proposal ids on `Sale`, `Expense`, and `Payment` for idempotent confirmations, not a
  stored proposal or chat history.
- **Assistant limits are deliberately small.** A question is at most 500 characters; one
  answer uses at most four model rounds and eight tool calls. This bounds latency and provider
  cost on a shop laptop and keeps a confused model from looping.
- **Shop data leaves the laptop only when the assistant is configured.** The question and the
  figures needed to answer it go to the configured provider. The README documents a local
  Ollama option for shops that want the data to stay on the laptop.
- **The assistant is reached from the dashboard and More, not the main navigation.** It is a
  secondary tool, so adding it did not lengthen the phone header.

- **Phase 8 uses a cookie locale, not a database setting.** A `shop_locale` cookie (`en` or
  `ps`) defaults to English and is read on the server to set `lang`/`dir` and the dictionary.
  No migration is needed; each browser remembers its own choice.
- **Pashto is additive, not a rewrite.** English strings stay in place; a `t()` helper picks
  the locale dictionary. Business data stored in the database is not translated — only labels,
  headings, buttons, and assistant copy.
- **RTL uses logical Tailwind utilities.** `ms`/`me`/`ps`/`pe`, `text-start`/`text-end`, and
  `start`/`end` replace physical left/right classes where direction matters. Protected
  `components/ui/*` shadcn files are not edited; RTL fixes for them live in `globals.css`.
- **Money stays in Latin digits and `Rs.` in both locales.** Parsing, formatting, and
  reconciliation keep using `formatPaisa` and `toMilli`; Pashto labels wrap them.
- **Numbers and dates keep Gregorian/Latin form.** Dates stay `Asia/Karachi`; the UI does not
  switch to a Pashto calendar.
- **Inputs are bidi-safe.** Names, notes, and search use `dir="auto"`; money, quantity, phone,
  receipt number, and barcode use `dir="ltr"`/`bdi`.
- **Text inputs are normalized before matching.** Product/customer search, duplicate
  detection, and assistant resolution fold Arabic/Pashto character variants (ي/ی, ك/ک, ZWNJ),
  convert Pashto digits to Arabic digits, strip tatweel/diacritics, and collapse whitespace.
- **The assistant answers in Pashto.** Tool descriptions stay English for the model; the
  system prompt instructs Pashto answers and exact quoting of formatted figures. Proposal
  tokens, write rules, and the one-proposal-per-answer guard are unchanged.
- **No new schema or migration.** Phase 8 adds no database changes; proposal id fields and
  alias parsing from Phase 7 are reused.

- **The assistant is reached from the dashboard and More, not the main navigation.** It is a
  secondary tool, so adding it did not lengthen the phone header.

- **Phase 10 uses two user roles: `OWNER` and `CUSTOMER`.** The `User.role` field already
  supports `OWNER` | `CASHIER`; `CUSTOMER` is added as a third value. `OWNER` has full access
  to all screens and actions. `CUSTOMER` has view-only access to their own khata (balance,
  credit sales, repayment history) and cannot access sell, products, reports, or any write
  path.
- **Customer accounts are linked to existing `Customer` records.** `User.customerId` is a
  nullable foreign key to `Customer.id`, one-to-one. Self-registration creates both a `User`
  (role `CUSTOMER`) and a `Customer` record in one transaction. The shopkeeper can also create
  customer accounts from the admin side.
- **Self-registration is allowed for customers.** The "no self-registration" rule from Phase 5.5
  applied to the shopkeeper owner only. Customer self-registration uses a separate sign-up page
  (`/customers/sign-up`) with name, phone, and password. Phone is required so the customer can
  be matched to their khata.
- **Same login screen for both roles.** `/login` accepts any `User` role. After login, the UI
  adapts: `OWNER` sees the full shop interface; `CUSTOMER` sees only their khata view.
- **Permission enforcement is server-side.** The proxy redirects pages by role, and every
  shopkeeper server action calls `requireOwner()` before touching data. `CUSTOMER` users are
  redirected away from shopkeeper-only routes (sell, products, reports, expenses, etc.), and
  the khata page itself re-checks that the session role is `CUSTOMER`.
- **Customer view shows full khata history.** Customers see their current balance, all credit
  sales (date, receipt number, amount, amount paid), and all repayments (date, amount, note).
  The same `customerHistory` and `customerBalancePaisa` queries used by the shopkeeper side are
  reused, filtered by the customer's own `Customer.id`. Line items are deliberately omitted so
  customers do not see product prices or margins.
- **Phase 10 is additive.** It adds a role value, a nullable foreign key column, and new pages;
  existing Phase 0–9 behavior is unchanged. Existing sessions pick up `customerId` on their next
  request because the JWT callback re-reads the user.

- **Phase 11 keeps the camera out of the app process.** A Python + OpenCV service under
  `services/camera/` captures the laptop webcam (device index configurable so an IP camera can
  replace it later), detects motion, writes short clips to `media/camera/`, and posts alert
  metadata to the app over local HTTP. The service authenticates with a shared secret token
  from `.env` (`CAMERA_ALERT_TOKEN`) and holds no business data of its own.
- **Clip metadata lives in the database; video bytes live on disk.** A `CameraAlert` row stores
  the clip path, capture time, duration, and review state. The file is never under `public/`:
  the app streams it through an authenticated, owner-only route handler so a `CUSTOMER` session
  or an anonymous request cannot fetch surveillance footage.
- **Alerts are flagged, never judged.** Motion triggers a clip and a review task; only the
  shopkeeper decides what it means. No automatic accusation, no face detection, no notification
  beyond the in-app alerts page.
- **Clips are disposable, metadata is accountable.** Retention keeps the newest clips and
  deletes older files after posting a new one; review state and audit rows survive clip deletion
  because the audit trail never depends on the media file.

- **Phase 12 is a spike, not a feature.** Face processing runs in a separate process under
  `services/face/` (same boundary as the camera service); the Next.js app never runs models
  and no product UI exists in this phase. Everything is offline — no cloud face APIs, models
  downloaded once and kept local.
- **Biometric data is minimal and deletable.** The spike stores a numeric face embedding plus
  the consented reference photo, both deletable on request; deletion is verified before the
  spike ends. Embeddings are not reversible to a photo, and photos never leave the laptop.
- **Recognition never accuses.** A match is a hint for human review, exactly like motion
  clips. The spike reports confidence numbers; it never names a person automatically in any
  product surface.

## Session Notes

- Verified environment: Node.js v22.22.1, npm 9.2.0 (global prefix `/usr/local` is not
  writable, so npm was not upgraded), Python 3.14.4, ffmpeg 8.0.1, no PostgreSQL, no Docker.
- Update (2026-11-04): `opencv-python-headless` now ships cp314 wheels — it installed
  version 5.0.0 on the laptop's Python 3.14.4, so no separate Python 3.12 environment is
  needed. The camera service uses a virtual environment in `services/camera/.venv` and
  transcodes clips to H.264 with the ffmpeg already on the laptop (browsers cannot play
  OpenCV's raw mp4v output).
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
- Phase 5.5 installed `next-auth@5.0.0-beta.32` and `bcryptjs@3.0.3`. Auth.js v5 is still a
  beta release; it declares Next 16 support in its peer dependencies. `bcryptjs` ships its
  own types, so no `@types` package was added.
- Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`; `middleware.ts` is
  deprecated. The route gate lives in `src/proxy.ts`.
- The `auth` wrapper in the proxy runs the JWT callback, which re-reads the `User` row. This
  costs one small SQLite read per protected request. For a single local shop that is
  acceptable; if it ever becomes a bottleneck, use `getToken` in the proxy and keep
  `requireUser()` as the authoritative check.
- The real database now has the owner `owner` (id `cmvrgygsp0000uarxr2j76ddh`) and
  `tokenVersion` 1 after the invalidation check. The owner password is in `.env`; change it
  there and run `npm run db:seed` to update it.
- The login flow was verified through the Auth.js CSRF callback endpoint, not the browser
  form. The phone check should confirm the `/login` form, the header username, and sign-out.
- The test database is rebuilt with `prisma migrate deploy`; the new `users` table has no
  foreign keys, so the existing cleanup order is unchanged. The auth test deletes users in
  its own `beforeEach`.
- Phase 6 added no schema change and no dependency. The provider adapter uses the global
  `fetch`, and `z.toJSONSchema` (already in the installed Zod) generates the model-facing tool
  schemas. The `$schema` key is removed before the definitions are sent.
- The assistant configuration is read at request time, but Next loads `.env` at startup, so
  changing `AI_BASE_URL`, `AI_API_KEY`, or `AI_MODEL` requires a server restart.
- The assistant is now configured against Google Gemini's OpenAI-compatible endpoint with
  `gemini-3.5-flash-lite`. A real question — "Who owes me money, and which products are low on
  stock?" — answered "ali khan owes Rs. 400.00" and "No products are currently at or below
  their low-stock level." Gemini's endpoint rejects the follow-up turn unless the
  `thought_signature` from each tool call is echoed back; the adapter preserves it as opaque
  `extra_content`. The configured `/assistant` page renders the chat (HTTP 200) after sign-in.
- Added `.github/workflows/ci.yml` (typecheck, lint, test, build on pushes, pull requests, and
  `v*` tags) and `.github/workflows/cd.yml` (manual/tag deployment to the shop laptop through
  a self-hosted runner; verifies, builds, backs up the SQLite database, migrates, restarts,
  and health-checks). Both pass `actionlint` 1.7.12. The CI build was reproduced locally with
  CI-only `DATABASE_URL` and `AUTH_SECRET` values.
- Added `.github/workflows/vercel-preview.yml`: deploys a Vercel preview for each pull request
  and keeps one sticky PR comment updated with the link. Fork PRs are skipped so the token is
  not exposed. It needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and the Vercel
  project environment. Because the app still uses SQLite, previews are UI-only until a hosted
  database is added.
- The Phase 6 verification used a production `next start` on port 3001 with the mock provider
  environment, while the normal dev server stayed on 3000. The mock server and the 3001
  process were stopped afterward; `.env` was not changed.
- The real dev database has no sales dated 28 Oct 2026, so the mock end-to-end loop correctly
  answered "Rs. 0.00 today across 0 sales." The loop used the real database read-only.
- The assistant chat and the Phase 5.5 login form still need a final phone check on the LAN
  URL. Both are designed for a phone, but a real-device pass has not been recorded.
- Phase 7 added migration `20261028120000_add_sale_proposal_id`, applied to `prisma/dev.db`;
  the Prisma client was regenerated. The migration only adds a nullable `proposalId` column and
  a unique index. `migrate dev` refuses to run non-interactively in this environment, so the
  migration SQL was written and applied with `migrate deploy`. Restart the dev server after
  `prisma generate`; the long-running process keeps the old client.
- The shared `priceSale` refactor keeps the sell-screen contract: the existing 13 sales tests
  still pass, including stock rejection, discount, change, and credit rules. The proposal and
  confirmation tests use the same pricing path.
- The proposal token is signed with a key derived from `AUTH_SECRET` and is not sent to the
  model. Only the model-facing summary goes into the tool message; the browser receives the
  token for the confirmation card. Changing `AUTH_SECRET` invalidates unconfirmed proposals,
  which is acceptable.
- Customer lookup in the proposal tool reads all customers and normalizes phone digits. Passing
  a spaced phone to `listCustomersWithBalances(search)` failed to match a stored phone with
  dashes because the query uses `contains`; normalizing in memory fixed it.
- A live Gemini check prepared a proposal for "Sell 1 piece of Dove Shampo for cash." for
  Rs. 400.00 and wrote nothing. A second live run against the disposable `prisma/test.db`
  confirmed a Rs. 25.00 sale for a seeded item: stock 5 → 4, audit actor `live-owner`,
  `details.source = "assistant_proposal"`. The next test run's global setup deletes that test
  database and rebuilds it.
- Phase 7 work is on branch `phase-7-assistant-sale-proposals`, pushed in commits `c0d423a`,
  `e5d525d`, `442da3b`, and `f6b00fd`. Pull request #1 is open:
  https://github.com/Eng-AttaUllah/AI-Shopkeeper/pull/1. CI passed (typecheck, lint, test,
  build). The Vercel Preview Actions workflow failed at the deploy step because the
  `VERCEL_TOKEN` repository secret is not set; the Vercel Git integration deployment also
  failed, likely because the Vercel Preview environment lacks `DATABASE_URL` and
  `AUTH_SECRET`. No preview URL exists yet. The repository variables `VERCEL_ORG_ID` and
  `VERCEL_PROJECT_ID` are now set from the existing Vercel project; only the `VERCEL_TOKEN`
  secret and the Vercel Preview environment values remain. Add them, then rerun the workflow
  or push a commit. The local environment has a GitHub credential but no `gh` binary; the PR
  was created through the GitHub API.
- Phase 7.1 added migration `20261029120000_add_expense_payment_proposal_id`, applied to
  `prisma/dev.db`; the Prisma client was regenerated. The migration only adds nullable
  `proposalId` columns and unique indexes to `expenses` and `payments`. The test global setup
  rebuilds `prisma/test.db` from all migrations on every run.
- Phase 7.1 work is on branch `phase-7b-expense-payment-proposals`, stacked on the Phase 7
  branch. Pull request #2 targets `phase-7-assistant-sale-proposals`:
  https://github.com/Eng-AttaUllah/AI-Shopkeeper/pull/2. It is deliberately not merged. CI
  passed via manual dispatch (run 40818562612 for the implementation commit, then
  40818701633 for the docs commit). The live Gemini check used the disposable test database;
  the test global setup replaced that data on the next run.
- 2026-11-06: Logo exploration — six directions (standalone mark plus app tile for each) are
  in `logo/concepts/`, with `logo/preview.html` for side-by-side comparison and 512px PNG
  previews in `logo/png/`. No app code was changed. The owner picked the Open Ledger and asked
  for a modern Book-E version with the app name **EasyShop**; that second pass (B1 Spine-E,
  B2 Folded-E, B3 Spine-E + spark, plus wordmark lockups) is in `logo/easyshop/` with its own
  `preview.html`. Still no app code changed: the B-variant pick is pending, then the favicon,
  app icons, header/sign-in placement, and the AI Shopkeeper → EasyShop rename follow.
