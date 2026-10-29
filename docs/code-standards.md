# Code Standards

## General

- Keep modules small and single-purpose. One folder per domain, one reason to change.
- Fix root causes. Do not layer workarounds or leave commented-out code behind.
- Do not mix unrelated concerns in one component, route, or module.
- Prefer readable code over clever code. A shopkeeper's money depends on this code.
- No dead code, no unused exports, no TODO comments without a matching entry in
  `progress-tracker.md`.
- Every new dependency needs a documented reason in `progress-tracker.md` under
  Architecture Decisions. Do not add a library for something ten lines of code can do.
- Never commit secrets. API keys, passwords, and database files stay out of git.

## TypeScript

- `strict` mode is required. `noUncheckedIndexedAccess` is enabled.
- No `any`. Use explicit interfaces, discriminated unions, or `unknown` narrowed by Zod.
- Validate unknown external input at system boundaries before trusting it: form data, route
  handler bodies, search params, and anything read from disk.
- Derive types from Zod schemas (`z.infer`) so validation and types cannot drift apart.
- Server actions and route handlers return a predictable result type: either
  `{ ok: true, data }` (or `{ ok: true }` when there is nothing to return), or
  `{ ok: false, error, fieldErrors? }`. Never throw raw errors at UI code.
- Use `const` by default. Avoid non-null assertions (`!`); narrow instead.
- Money is `number` but always an integer number of paisa. Never use `parseFloat` on money.

## Next.js

- Default to server components. Add `"use client"` only where browser interactivity
  genuinely requires it, and keep such components as small as possible.
- Fetch data in server components or server actions, never in `useEffect`.
- Keep route handlers and server actions thin: validate, authorise, call one module
  function, return a result.
- Never import server-only modules (`src/lib/db.ts`, auth config, bcrypt) into a client
  component.
- Use `revalidatePath` after a successful mutation so server-rendered data stays correct.
- Handle loading and error states explicitly. No blank screens on failure.
- All pages that read business data must be protected by `src/proxy.ts` and re-check the
  session server-side before mutating.

## Styling

- Use CSS custom property tokens defined in `ui-context.md`. No hardcoded hex values or
  ad-hoc colours in components.
- Use Tailwind utilities with tokens (`bg-[var(--bg-surface)]` or the mapped theme classes).
- Follow the border radius scale in `ui-context.md`. Do not invent new radii.
- Mobile-first: design for a 360px-wide phone, then enhance for tablet and desktop.
- Tap targets are at least 44x44px. Text is at least 16px on inputs so mobile browsers do not
  zoom on focus.
- Never encode meaning in colour alone. Pair it with text or an icon.

## API Routes and Server Actions

- Parse and validate input with Zod before any logic runs.
- Enforce the session check and authorisation before any mutation. Call `requireUser()` at
  the top of every server action and pass `session.user.username` to services that write
  audit entries.
- Return consistent, predictable response shapes; never leak stack traces or raw Prisma
  messages to the client.
- Convert known database errors into user-readable messages (for example, insufficient stock
  or a duplicate product name).
- Any handler that touches both money and stock must call a single service function that owns
  the transaction. Handlers never open their own transactions.

## AI and the Assistant

- Read-only questions use the registry in `src/modules/assistant/tools.ts`. No read-only tool
  may create, update, void, or delete a record, and read-only assistant code must not call a
  service that writes.
- Sale, expense, payment, customer, product, product-edit, and stock-adjustment proposals use
  separate tools in `src/modules/assistant/sale-proposal.ts`, `expense-proposal.ts`,
  `payment-proposal.ts`, `customer-proposal.ts`, `product-proposal.ts`,
  `product-update-proposal.ts`, and `stock-adjustment-proposal.ts`, registered in
  `proposal-tools.ts`. They may read products, customers, or the khata balance, price or
  validate the draft, and sign a proposal. They must never call a write service or confirm
  their own proposal. One assistant answer carries at most one proposal.
- Only the matching confirmation server action may write a proposal. It must verify the
  signed, user-bound, short-lived token; re-price the sale, re-validate the expense, re-read
  the khata balance for a payment, compare a product's signed before-state, or re-read current
  stock for an adjustment inside the write transaction; and reject the write if the preview
  the shopkeeper saw is stale. The model cannot confirm, and no automatic retry or URL may
  write a record.
- Every confirmed proposal carries a nullable, unique proposal id. Customer, product, stock
  movement, sale, expense, and payment rows store it directly; a product edit stores it on its
  audit row because it updates an existing row. The confirmation must look up that id first and
  return the existing row on replay. For payments, the replay lookup runs before the
  stale-balance check.
- Every tool has a Zod input schema and is registered explicitly. Unknown tool names and
  invalid arguments are rejected before execution. Never let the model call an arbitrary
  function or generate SQL.
- Tool results are derived from the same `src/modules` queries the screens use and formatted
  with `src/lib/format.ts`. The model quotes those figures; it never calculates money.
- Provider calls stay behind the `ChatProvider` interface in `src/lib/ai/`. Domain modules
  receive the interface, not a vendor SDK. The adapter is configured by environment variables,
  and the API key never reaches the browser.
- Validate the question, history, and every tool argument with Zod on the server. The
  assistant server action also calls `requireUser()`.
- Never log secrets, API keys, full prompts, or shop figures. Log a provider failure on the
  server and return a short, safe message to the UI.
- Chat history is not persisted. Phase 7 stores only nullable, unique proposal ids on `Sale`,
  `Expense`, `Payment`, `Customer`, `Product`, `StockMovement`, and `AuditLog` for idempotent
  confirmations, not the conversation or the proposal. Saving chat history later requires a
  documented retention and privacy decision.
- Tests use a fake `ChatProvider`; no test may call a real AI endpoint. A provider or model
  change is configuration, not a code change, and `.env.example` stays blank by default.

## Data and Storage

- Business and metadata belong in the database.
- Large content (images, video clips, backups) belongs on disk, referenced by path.
- Do not store large binary content inside the database.
- Money is integer paisa. Dates are `Date` in UTC, formatted with `Asia/Karachi` at the edge.
- Use `Prisma.$transaction` for operations with more than one dependent write.
- Select only the columns needed. Avoid `select *` style wide reads in list screens.
- Migrations are additive and reviewable. Never edit a committed migration; add a new one.
- Seed data must be idempotent and safe to run repeatedly.

## File Organization

- `src/app/` — routes, layouts, and page-level composition only.
- `src/modules/` — domain logic: `schema.ts`, `service.ts`, `queries.ts`, plus domain-only
  helpers. The assistant module also owns its read-only tool registry, range resolver, signed
  proposal tools, and confirmation services.
- `src/lib/` — cross-domain infrastructure: db, auth, AI provider adapter and config, money,
  dates, formatting, results.
- `src/components/` — reusable UI; `src/components/ui/` is shadcn-generated and protected.
- `prisma/` — schema, migrations, seed.
- `tests/` — unit and integration tests mirroring the module structure.
- `docs/` — the specification. Updated whenever behaviour, architecture, or scope changes.

## Naming

- Files: `kebab-case.ts` for modules and utilities, `PascalCase.tsx` for React components.
- Database models: `PascalCase` singular (`Sale`, `SaleItem`). Tables map to `snake_case`
  plural via `@@map`.
- Server actions: verb-first (`createSale`, `voidSale`, `recordPayment`).
- Query functions: `get*` / `list*` and read-only by convention.
- Booleans read as assertions (`isActive`, `hasStock`), not nouns.
- Never abbreviate domain words (`customer`, not `cust`; `quantity`, not `qty`, except in
  Prisma field names where it is already established and consistent).

## Testing

- Business logic in `src/modules/*/service.ts` and `src/lib/money.ts` requires unit tests.
- Every invariant in `architecture.md` that can be tested must have a test: stock cannot go
  negative, sale creation is atomic, void restores stock, profit uses the cost snapshot.
- Tests use a disposable SQLite database and are independent of execution order.
- A change is not complete until `npm test` and `npm run build` pass.

## Commits

- One logical change per commit, written in the imperative mood.
- Commit messages describe behaviour, not file lists ("Reject sales that exceed stock",
  not "update service.ts").
- Never commit `.env`, `*.db`, or anything inside `backups/`.
