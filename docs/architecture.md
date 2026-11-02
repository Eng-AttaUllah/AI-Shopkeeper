# Architecture Context

## Stack

| Layer | Technology | Role |
| ----- | ---------- | ---- |
| Framework | Next.js (App Router) + TypeScript (strict) | Routing, server components, server actions and route handlers |
| UI | Tailwind CSS v4 (via `@tailwindcss/postcss`) + shadcn/ui + Lucide React | Styling, accessible components, icons |
| Auth | Auth.js (NextAuth) v5 — Credentials provider, JWT sessions, bcryptjs | Sign-in, session, route protection |
| Database | Prisma ORM 7 + SQLite (better-sqlite3 driver adapter) | Schema, migrations, all business data |
| Validation | Zod | Validating every boundary: forms, route handlers, server actions |
| Charts | Recharts | Sales and profit charts |
| Tests | Vitest | Unit and integration tests for business logic |
| Runtime | Node.js 22 on the shop's laptop | Hosts the app for the local network |
| Future: camera | Python + OpenCV, separate process | Person/zone detection, clip capture, alert posting |
| AI (Phases 6–7) | OpenAI-compatible adapter behind one interface, called with `fetch` | Answers read-only shop questions and prepares signed sale, expense, repayment, customer, product, and stock proposals that only the shopkeeper can confirm |

## System Boundaries

- `src/app/` — Routing and screens only. Server components by default. Must not contain
  business rules or direct money calculations; it calls into `src/modules/`.
- `src/modules/` — Business logic, one folder per domain (`products`, `sales`, `customers`,
  `reports`, `expenses`, `cash`, `assistant`). Each folder exposes `schema.ts` (Zod),
  `service.ts` (mutations and rules), and `queries.ts` (reads); the assistant also owns its
  read-only tool registry, range resolver, and signed proposal tools. Owns all
  invariants. Auth is infrastructure, not a domain module: its config and credential rules
  live in `src/lib`.
- `src/lib/` — Shared infrastructure: Prisma client, Auth.js configuration and credential
  verification, the OpenAI-compatible AI provider adapter and configuration, money helpers,
  date and timezone helpers, formatting, result/error types, audit and backup utilities.
- `src/components/` — Presentational and composed UI, including the assistant chat. The
  generated `src/components/ui/` is protected.
- `prisma/` — `schema.prisma`, migrations, and the seed script. Owns the data model.
- `docs/` — The specification. Single source of truth for what to build and how.
- `tests/` — Tests for business logic and invariants.
- `backups/` — Timestamped database copies. Never committed to git.
- Future: `services/camera/` — Python service. Communicates with the app over a local HTTP
  endpoint and holds no business data of its own.

Request flow is one direction: `app` → `modules` → `lib` → database. Modules never import
from `app`, and `lib` never imports from `modules`.

## Storage Model

- **SQLite database (`prisma/dev.db` in development, `prisma/prod.db` in production)**:
  all users, products, aliases, customers, sales, sale items, payments, expenses, stock
  movements, audit logs, settings, and cash-reconciliation records.
- **`backups/`**: timestamped copies of the database file, produced daily and on demand.
  Retention: keep the last 30 daily backups.
- **Expenses, audit logs, and cash-reconciliation records** are append-only or per-shop-day
  snapshots: expenses are never edited, audit rows are never updated, and a cash check is
  upserted once per business date.
- **`public/uploads/products/`** (later): product images, referenced by path from the
  database — never stored as blobs inside the database.
- **`media/camera/`** (later): short alert clips. Metadata lives in the database; the video
  bytes live on disk.
- No external blob storage, no cloud storage, and no file storage of financial records in v1.

## Reliability and Audit

- Expenses are append-only and dated at shop-local midnight. Net profit is gross profit minus
  expenses in the same range.
- A sale is voided, never edited. A void requires a reason, restores each line with a `VOID`
  stock movement, and writes a `SALE_VOIDED` audit entry in the same transaction. A credit sale
  with repayments applied is blocked because the derived khata balance would go negative;
  refunds are not implemented yet. A cash refund for a voided cash sale is not recorded either;
  the expected cash excludes the voided sale, so the refund is handled outside the app.
- Every money or stock mutation writes its audit entry in the same transaction. The entry
  records actor (the signed-in username; rows written before sign-in say `local`), action,
  entity type/id, summary, before JSON, and after JSON. A failed transaction leaves neither
  the change nor its audit row.
- Expected cash = cash sales + cash paid on credit sales + repayments − expenses, excluding
  voided sales. Expenses are assumed paid from the drawer. A cash check is a snapshot per shop
  day; a later void changes the live breakdown but does not rewrite a saved check.
- Backups use SQLite's online backup API, so a copy is consistent while the app runs. One daily
  backup is made when the dashboard or `/backups` is opened; the last 30 daily files are kept.
  Manual backups are kept until deleted. Restore is a file copy with the app stopped.

## Prisma and Tooling Configuration

- Prisma CLI configuration lives in `prisma7.config.ts` (Prisma 7's config file name).
  It loads `.env` through `dotenv`, points at `prisma/schema.prisma`, sets the migrations
  path, and registers `tsx prisma/seed.ts` as the seed command.
- Prisma Client is generated to `src/generated/prisma` and is ignored by git. It is never
  edited by hand and is regenerated by `npm install` (postinstall) or `npm run db:migrate`.
- Prisma 7 requires a driver adapter. The application creates one
  `PrismaBetterSqlite3` adapter from `DATABASE_URL` in `src/lib/db.ts`, and that file is the
  only place a `PrismaClient` is constructed. The seed script imports the same client and
  disconnects when it finishes.
- `better-sqlite3` is also a direct dependency for SQLite's online backup API
  (`src/lib/backup.ts`). It was already the Prisma adapter driver, so this does not add a
  second database engine.
- Tailwind CSS v4 is compiled through `@tailwindcss/postcss` (`postcss.config.mjs`). The
  Turbopack CSS-loader rule is deliberately not used: it also intercepts Next's generated
  font CSS and breaks `next/font`.
- Tests run on Vitest with `vitest.config.mts`; the `@/*` alias mirrors `tsconfig.json`.
- `next dev` runs webpack with `WATCHPACK_POLLING=true` on this machine. The system's
  inotify watch limit is consumed by other applications, and both Turbopack and native
  watching crash with `ENOSPC`. `npm run dev:turbo` is available where the limit allows it.
  `next build` still uses Turbopack.

## Auth and Access Model

- Every user signs in with username and password through Auth.js Credentials. Passwords are
  stored only as bcrypt hashes in `src/lib/credentials.ts`. The shopkeeper owner account is
  seeded from `.env`; customers may self-register at `/customers/sign-up`, where the phone
  number becomes the username. The shopkeeper can also create a customer account from the
  customer detail page. There is no shopkeeper self-registration.
- Auth.js requires JWT session strategy with the Credentials provider. Sessions are signed
  cookies with an 8-hour lifetime, refreshed while the shopkeeper is active; a
  `tokenVersion` on the user invalidates sessions when a password changes. The JWT callback
  re-reads the user so a deleted user or a changed `tokenVersion` signs the session out.
- `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`) protects every route except
  `/login`, `/customers/sign-up`, the Auth.js endpoints, and static assets. Unauthenticated
  requests are redirected to `/login` with the original path in `from`. Signed-in `CUSTOMER`
  users are redirected to `/customers/khata` from every other page, and shopkeeper-only users
  are redirected away from `/customers/khata`.
- The system is single-tenant: it serves exactly one shop. Ownership is implicit — every
  business record belongs to that shop. `settings` holds the shop identity.
- `User.role` is `OWNER`, `CASHIER`, or `CUSTOMER`. v1 seeds one `OWNER`. `CASHIER` is
  reserved for a later phase. `CUSTOMER` users are view-only: they can read their own khata
  (balance, credit sales, repayments) and nothing else. `User.customerId` links a `CUSTOMER`
  user to exactly one `Customer` record (unique, nullable).
- The seed reads `OWNER_USERNAME`, `OWNER_PASSWORD`, and `OWNER_NAME` from `.env`. Re-running
  the seed with a different password updates the hash and increments `tokenVersion`.
- All mutations happen on the server (server actions or route handlers). The browser never
  talks to the database, and no database credentials are exposed to the client.
- Server-side code enforces authorisation on every mutation: every server action calls
  `requireUser()` (any signed-in user) or `requireOwner()` (shopkeeper-only) before changing
  data. The proxy is an optimistic gate only. Hiding a button in the UI is never treated as
  access control. A `CUSTOMER` must never reach a shopkeeper mutation.
- The audit actor is the signed-in username. The service functions accept an optional actor
  that defaults to `local`, so tests and seed code can run outside a session; server actions
  pass `session.user.username`.

## Assistant (Phases 6–7)

The assistant is an optional, post-v1 feature. Phase 6 answers questions about the shop and
cannot create, edit, void, or delete a record. Phase 7 adds write-shaped proposals: the
assistant can prepare a **sale, expense, khata repayment, customer, product, product edit, or
stock adjustment**, but only the signed-in shopkeeper can confirm it.

### Read-only questions

- **Provider.** Any OpenAI-compatible `/chat/completions` endpoint, called with `fetch` from
  `src/lib/ai/openai-compatible.ts`. Configuration is `AI_BASE_URL`, `AI_API_KEY` (optional
  for local models), and `AI_MODEL`. There is no vendor SDK and no provider-specific code in
  the domain modules. If the endpoint is not configured, `/assistant` shows setup
  instructions and the rest of the app works normally. Provider metadata attached to a tool
  call (for example Gemini's `thought_signature`) is treated as opaque and echoed back
  unchanged on the next turn; it is never executed or shown.
- **No text-to-SQL and no arbitrary functions.** The model receives a closed list of tool
  definitions generated from Zod schemas with `z.toJSONSchema`. The read-only registry lives
  in `src/modules/assistant/tools.ts`; an unknown tool name or invalid arguments are rejected
  before any query runs. The model never sees SQL, table names, or the database.
- **Approved read-only tools.** `sales_summary`, `top_products`, `product_sales`,
  `low_stock`, `outstanding_credit`, `customer_balance`, `inventory_value`, `slow_moving`,
  `recent_sales`, `expenses_summary`, and `expected_cash`. Each returns figures derived from
  the same queries the screens use, formatted with `src/lib/format.ts`. The model is told to
  quote those figures exactly and never to estimate.
- **Server-side orchestration.** `answerShopQuestion` builds the system prompt, adds at most
  six prior turns, and runs at most four model rounds and eight tool calls. Provider errors
  become a short, safe message; the details are logged on the server. The server action calls
  `requireUser()` and re-validates the question and history with Zod.
- **No chat persistence.** Conversation history is client state for the open page only. There
  is no chat table. Phase 7 adds only nullable, unique proposal ids on `Sale`, `Expense`,
  `Payment`, `Customer`, `Product`, and `StockMovement`, plus a nullable unique proposal id on
  `AuditLog` for product edits, for idempotent confirmations, not a transcript. Reloading
  `/assistant` clears the transcript and any unconfirmed proposal.
- **Privacy.** The question and the shop figures needed to answer it are sent to the
  configured provider. A local model (for example Ollama) keeps the data on the laptop. The
  API key stays in the server environment and is never sent to the browser.

### Proposals (Phase 7)

- **Separate registry.** The proposal tools live in their own modules, not in the read-only
  registry `src/modules/assistant/tools.ts`:
  - `propose_sale` in `sale-proposal.ts` reads products and customers, prices the draft with
    `priceSale`, and signs the result.
  - `propose_expense` in `expense-proposal.ts` resolves the category, amount, and shop date.
  - `propose_payment` in `payment-proposal.ts` resolves an existing customer and reads the
    current outstanding khata balance.
  - `propose_customer` in `customer-proposal.ts` resolves a new customer and rejects an exact
    duplicate name or phone.
  - `propose_product` in `product-proposal.ts` resolves a new product, its unit, prices, and
    opening stock, and rejects a duplicate name or barcode.
  - `propose_product_update` in `product-update-proposal.ts` resolves an existing product and
    signs both its current snapshot and the requested after-state.
  - `propose_stock_adjustment` in `stock-adjustment-proposal.ts` resolves a product, a signed
    quantity, and a stock reason, and rejects a below-zero result.
  `proposal-tools.ts` registers the seven tools and enforces one proposal per answer. No
  proposal tool writes.
- **Explicit confirmation.** The UI renders a warning-tinted card labelled "Proposed sale —
  not saved yet", "Proposed expense — not saved yet", "Proposed payment — not saved yet",
  "Proposed customer — not saved yet", "Proposed product — not saved yet", "Proposed product
  change — not saved yet", or "Proposed stock adjustment — not saved yet". The shopkeeper must
  press **Confirm sale**, **Confirm expense**, **Confirm payment**, **Confirm customer**,
  **Confirm product**, **Confirm changes**, or **Confirm adjustment**; the model cannot confirm,
  and no URL or automatic retry writes the record.
- **Signed, short-lived, user-bound.** Each payload contains the exact draft and the preview
  the shopkeeper saw. It is signed with a purpose-specific key derived from `AUTH_SECRET`
  (HMAC-SHA256), bound to the signed-in user id, and expires after 15 minutes. The proposal is
  not stored; the resulting row stores the proposal id, except a product edit, which stores it
  on its audit row.
- **One transaction, exact preview.**
  - **Sale:** `confirmSaleProposalAction` verifies the token, then calls
    `createSaleWithStatus` with `proposalId` and `expectedPreview`. The sale service re-prices
    the draft inside its transaction and refuses to write if prices, stock, customer, note, or
    lines no longer produce the preview the shopkeeper saw. The write creates the sale, lines,
    stock movements, decrements, audit row, and khata effect together.
  - **Expense:** `confirmExpenseProposalAction` verifies the token and calls
    `createExpenseWithStatus` with the signed draft, preview, and proposal id. The expense and
    its audit row are written in one transaction. Expenses have no external price or stock to
    re-read, so the draft/preview comparison plus the unique proposal id provide the guarantee.
  - **Payment:** `confirmPaymentProposalAction` verifies the token and calls
    `recordPaymentWithStatus`. Inside the transaction the service re-reads the derived khata
    balance and refuses to write if it differs from the preview, or if the amount exceeds the
    balance. The payment and audit row are written together.
  - **Customer:** `confirmCustomerProposalAction` verifies the token and calls
    `createCustomerWithStatus`. The customer and audit row are written in one transaction. The
    draft/preview comparison plus the unique proposal id provide the guarantee.
  - **Product creation:** `confirmProductProposalAction` verifies the token and calls
    `createProductWithStatus`. The product, its OPENING stock movement, and its audit row are
    written in one transaction.
  - **Product edit:** `confirmProductUpdateProposalAction` verifies the token and calls
    `updateProductWithStatus`. Inside the transaction the service compares the signed
    before-state with the current product and refuses to write if the product changed. The
    update, alias replacement, and audit row are written together.
  - **Stock adjustment:** `confirmStockAdjustmentProposalAction` verifies the token and calls
    `adjustStockWithStatus`. Inside the transaction the service re-reads the current stock and
    refuses to write if it differs from the preview or if the result would be negative. The
    stock update, movement, and audit row are written together.
- **Idempotent replay.** `Sale.proposalId`, `Expense.proposalId`, `Payment.proposalId`,
  `Customer.proposalId`, `Product.proposalId`, and `StockMovement.proposalId` are nullable and
  unique. A replayed confirmation returns the row already created instead of creating a second
  one. Product edits update an existing product, so `AuditLog.proposalId` is the unique
  idempotency record for that kind. For payments the idempotency lookup runs before the balance
  check, so a later repayment does not make the original confirmation look stale. Ordinary
  screen entries leave every proposal id null.
- **Audit.** Each confirmed row records the signed-in username and
  `details.source = "assistant_proposal"`, plus the proposal id.
- **Scope.** Sales, expenses, khata repayments, customer creation, product creation, product
  edits, and stock adjustments can be proposed. Customer edits, customer deletion, and product
  activation/deactivation remain out of scope until their own explicit-confirmation designs
  exist.

## Invariants

1. All monetary values are stored and computed as integers in paisa. No floating-point
   arithmetic is permitted anywhere in a money path.
2. Creating a sale is one database transaction: sale, sale items, stock movements, stock
   decrements, and customer balance update all succeed or all fail together.
3. Stock quantity can never become negative. The server rejects the operation with a clear,
   user-readable error and writes nothing.
4. Completed sales are immutable. Corrections happen by voiding the sale (which reverses
   stock and balances) and creating a new one. A void is itself an audited record.
5. Each sale item stores a snapshot of `unitPrice` and `unitCost` at the time of sale.
   Historical profit never uses a product's current cost price.
6. Stock is never written without a matching stock-movement row that carries a reason and a
   reference to its source record.
7. Every mutation that changes money or stock writes an audit-log entry with actor, action,
   entity, entity id, before, and after values. The actor is the signed-in username; rows
   written before sign-in existed use `local`.
8. All external input is validated with Zod on the server before any logic runs. Client-side
   validation exists only for user experience.
9. The database is the single source of truth. No derived figure is cached unless it can be
   fully recomputed and is repaired by a reconciliation routine.
10. All timestamps are stored in UTC and rendered in `Asia/Karachi`. Day, month, and year
    boundaries for reports are computed in `Asia/Karachi`.
11. Business rules live only in `src/modules/`. Route handlers and components orchestrate and
    display; they do not decide.
12. The AI layer may only call the approved, typed tool registries. Read-only questions use
    `src/modules/assistant/tools.ts`; sale, expense, payment, customer, product, product-edit,
    and stock-adjustment proposals use the separate signed-proposal tools registered in
    `src/modules/assistant/proposal-tools.ts`. Every tool has a Zod input schema and runs on
    the server; unknown tools and invalid arguments are rejected before execution. The
    assistant never generates SQL, never estimates or edits a financial figure, and never
    writes a financial record directly. A proposal is signed and short-lived; only the
    shopkeeper's matching confirmation action may write it. The write re-prices a sale,
    re-validates an expense, re-reads the khata balance for a payment, compares a product's
    signed before-state, or re-reads current stock for an adjustment inside the transaction and
    rejects a stale preview.
