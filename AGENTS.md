# AGENTS.md

## What this project is

EasyShop — an offline-first shop management system for one small retail shop,
running on a laptop and used from a phone browser on the shop's local network. Version 1 is
English-only and covers products, stock, sales, customers and credit (khata), expenses,
reports, and backups.

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

Phase 6 — the read-only assistant — and Phase 7 — signed sale, expense, khata repayment,
customer, product, product-edit, and stock-adjustment proposals — are complete. Phase 8,
Pashto support, is next. See `docs/progress-tracker.md` for the live task list and branch
status.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
