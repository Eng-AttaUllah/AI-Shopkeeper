# AI Shopkeeper Assistant

Offline-first shop management for a single small retail shop. Runs on a laptop
and is used from a phone browser on the shop's local network — no internet
connection required.

Version 1 is English-only and covers products and stock, sales, customers and
credit (khata), expenses, reports, and backups.

## Requirements

- Node.js 22 or newer
- npm 9 or newer

No database server is needed: the application uses a local SQLite file.

## Setup

```bash
cp .env.example .env     # database location
npm install              # also generates Prisma Client
npm run db:migrate       # create the SQLite database and tables
npm run db:seed          # add the demo shop record
npm run dev              # http://localhost:3000
```

To open the app from a phone on the same Wi-Fi, start the server bound to the
network and use the laptop's local IP address:

```bash
npm run dev -- --hostname 0.0.0.0
```

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build — must pass before moving on |
| `npm start` | Run the production build |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript check without emitting files |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a development migration |
| `npm run db:seed` | Insert seed data (idempotent) |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Project structure

```
src/app/          routes and screens (server components by default)
src/modules/      business logic, one folder per domain
src/lib/          database client, money and date helpers, shared utilities
src/components/   reusable UI components
src/generated/    Prisma Client output (generated, never edited)
prisma/           schema, migrations, seed script
tests/            unit and integration tests
docs/             the specification — read this before changing behaviour
backups/          local database backups (not committed)
```

## Documentation

The specification is the source of truth:

- `docs/project-overview.md` — scope, features, phases, success criteria
- `docs/architecture.md` — stack, boundaries, storage, auth, invariants
- `docs/code-standards.md` — how code must be written
- `docs/ui-context.md` — theme, tokens, components, layouts
- `docs/ai-workflow-rules.md` — how work is scoped and reported
- `docs/progress-tracker.md` — current phase, completed work, decisions

## Status

Phase 0 — environment setup complete: Next.js, TypeScript, Tailwind, Prisma +
SQLite, a seeded `Shop` record, and tested money helpers.

Next: Phase 1 — products and stock.
