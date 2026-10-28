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
| AI (Phase 6) | OpenAI-compatible adapter behind one interface, called with `fetch` | Answers read-only shop questions through approved, typed tools |

## System Boundaries

- `src/app/` — Routing and screens only. Server components by default. Must not contain
  business rules or direct money calculations; it calls into `src/modules/`.
- `src/modules/` — Business logic, one folder per domain (`products`, `sales`, `customers`,
  `reports`, `expenses`, `cash`, `assistant`). Each folder exposes `schema.ts` (Zod),
  `service.ts` (mutations and rules), and `queries.ts` (reads); the assistant also owns its
  read-only tool registry and range resolver. Owns all invariants. Auth is infrastructure,
  not a domain module: its config and credential rules live in `src/lib`.
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
  stored only as bcrypt hashes in `src/lib/credentials.ts`. There is no self-registration.
- Auth.js requires JWT session strategy with the Credentials provider. Sessions are signed
  cookies with an 8-hour lifetime, refreshed while the shopkeeper is active; a
  `tokenVersion` on the user invalidates sessions when a password changes. The JWT callback
  re-reads the user so a deleted user or a changed `tokenVersion` signs the session out.
- `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`) protects every route except
  `/login`, the Auth.js endpoints, and static assets. Unauthenticated requests are redirected
  to `/login` with the original path in `from`.
- The system is single-tenant: it serves exactly one shop. Ownership is implicit — every
  business record belongs to that shop. `settings` holds the shop identity.
- `User.role` is `OWNER` or `CASHIER`. v1 seeds one `OWNER`. Cashiers are reserved for a
  later phase and must not gain extra permissions without a documented decision.
- The seed reads `OWNER_USERNAME`, `OWNER_PASSWORD`, and `OWNER_NAME` from `.env`. Re-running
  the seed with a different password updates the hash and increments `tokenVersion`.
- All mutations happen on the server (server actions or route handlers). The browser never
  talks to the database, and no database credentials are exposed to the client.
- Server-side code enforces authorisation on every mutation: every server action calls
  `requireUser()` before changing data. The proxy is an optimistic gate only. Hiding a button
  in the UI is never treated as access control.
- The audit actor is the signed-in username. The service functions accept an optional actor
  that defaults to `local`, so tests and seed code can run outside a session; server actions
  pass `session.user.username`.

## Assistant (Phase 6)

The assistant is an optional, post-v1 feature. It is **read-only**: it answers questions
about the shop and cannot create, edit, void, or delete a record.

- **Provider.** Any OpenAI-compatible `/chat/completions` endpoint, called with `fetch` from
  `src/lib/ai/openai-compatible.ts`. Configuration is `AI_BASE_URL`, `AI_API_KEY` (optional
  for local models), and `AI_MODEL`. There is no vendor SDK and no provider-specific code in
  the domain modules. If the endpoint is not configured, `/assistant` shows setup
  instructions and the rest of the app works normally.
- **No text-to-SQL and no arbitrary functions.** The model receives a closed list of tool
  definitions generated from Zod schemas with `z.toJSONSchema`. The registry lives in
  `src/modules/assistant/tools.ts`; an unknown tool name or invalid arguments are rejected
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
  is no chat table and no schema migration. Reloading `/assistant` clears the transcript.
- **Privacy.** The question and the shop figures needed to answer it are sent to the
  configured provider. A local model (for example Ollama) keeps the data on the laptop. The
  API key stays in the server environment and is never sent to the browser.
- **Write actions are out of scope.** Phase 7 will need a separate, explicit-confirmation
  design. No write tool may be added to this registry.

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
12. The AI layer may only call the approved, typed, read-only tool registry in
    `src/modules/assistant/tools.ts`. Every tool has a Zod input schema and runs on the
    server; unknown tools and invalid arguments are rejected before execution. The assistant
    never generates SQL, never estimates or edits a financial figure, and never writes a
    financial record. Write actions (Phase 7) require a separate explicit-confirmation design.
