# AGENTS.md

## What this project is

EasyShop — a shop management system for small retail shops: products, stock,
sales, customers and credit (khata), expenses, reports, and backups. Built
through Phase 12 as a single-shop installation; Phase 13 (in progress) turns
it into a hosted platform serving many independent shops, with shopkeeper and
customer account types, shop discovery and joining, and strict per-shop data
isolation until every screen, action, and test reaches the invariant.

## Read the specs first

The specification lives in `docs/` and is the single source of truth. Before doing any work,
read:

1. `docs/project-overview.md` — what we build, scope, success criteria, phases
2. `docs/architecture.md` — stack, boundaries, storage, auth, **invariants**
3. `docs/progress-tracker.md` — current phase, completed work, open questions, decisions
4. `docs/code-standards.md` — how code must be written
5. `docs/ui-context.md` — theme, tokens, components, layout
6. `docs/ai-workflow-rules.md` — how work must be scoped and reported

If the docs and a request disagree, say so and resolve it in the docs before coding.

## Hard rules

- Never violate an invariant in `docs/architecture.md`. If a task seems to require it, stop
  and raise it first.
- Money is **integer paisa**. No floats, no `parseFloat` on money.
- Any operation touching money and stock runs in one `Prisma.$transaction`.
- Sales are voided, never edited. Cost and price are snapshotted on each sale line.
- Stock never goes negative and never changes without a `StockMovement` row.
- Validate all input with Zod on the server. Client validation is cosmetic only.
- Business logic lives in `src/modules/` only. Screens and route handlers orchestrate.
- Never build features listed as Out of Scope. Ask before expanding scope.
- Never claim something works without running it.

## Protected files

Do not modify unless explicitly instructed:

- `src/components/ui/*` (shadcn/ui generated)
- `prisma/migrations/*` (add a new migration instead)
- `docs/ai-workflow-rules.md`

## Workflow for every unit

1. Confirm the unit is the next item in `docs/progress-tracker.md`.
2. Implement the smallest complete slice.
3. Run `npm run build` and `npm test`.
4. Update `docs/progress-tracker.md` (completed, in progress, next, open questions,
   decisions).
5. Update any other affected doc, per "Keeping Docs in Sync" in `docs/ai-workflow-rules.md`.
6. Report: what works now, what was not built, decisions made, and how to see it.

## Commands

```bash
npm run dev        # development server (bind to LAN for phone testing)
npm run build      # production build — must pass before moving on
npm test           # unit and integration tests — must pass before moving on
npx prisma migrate dev   # create and apply a migration
npx prisma studio        # inspect the database
```

## Current state

Phase 8 — Pashto support — and Phases 9–12 are complete, as are the settings and UI
polish units. Phase 13, multi-shop accounts, is in progress: units 13.1 (docs), 13.2
(schema, membership, backfill migration, seed), 13.3 (tenancy plumbing — every module
function scoped by `shopId`), 13.4 (required `shopId`, composite uniques, `accountType`),
and 13.5 (signup and accounts) are done on `main`; unit 13.6 (discovery and joining)
follows. See `docs/progress-tracker.md` for the live task list and branch status.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
