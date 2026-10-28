# AI Shopkeeper Assistant

[![CI](https://github.com/Eng-AttaUllah/AI-Shopkeeper/actions/workflows/ci.yml/badge.svg)](https://github.com/Eng-AttaUllah/AI-Shopkeeper/actions/workflows/ci.yml)

Offline-first shop management for a single small retail shop. Runs on a laptop
and is used from a phone browser on the shop's local network — no internet
connection required.

Version 1 is English-only and covers products and stock, sales, customers and
credit (khata), expenses, reports, and backups. Phase 6 adds an optional
read-only assistant that answers questions about the shop's real figures.

## Requirements

- Node.js 22 or newer
- npm 9 or newer

No database server is needed: the application uses a local SQLite file.

## Setup

```bash
cp .env.example .env     # database location, auth secret, owner password
# edit .env: set AUTH_SECRET (openssl rand -hex 32) and OWNER_PASSWORD
npm install              # also generates Prisma Client
npm run db:migrate       # create the SQLite database and tables
npm run db:seed          # add the shop and the single owner account
npm run dev              # http://localhost:3000
```

Open `/login` and sign in with `OWNER_USERNAME` and `OWNER_PASSWORD` from `.env`. The
default username is `owner`.

To open the app from a phone on the same Wi-Fi, start the server bound to the
network and use the laptop's local IP address:

```bash
npm run dev -- --hostname 0.0.0.0
```

> **Why `npm run dev` uses webpack and polling:** this machine's inotify watch
> limit is already exhausted by other applications, so Turbopack and native
> file watching crash with `ENOSPC`. `npm run dev` therefore runs webpack with
> `WATCHPACK_POLLING=true`. On a machine without that limit you can use
> `npm run dev:turbo` for faster rebuilds.

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Development server with hot reload (polling, see note) |
| `npm run dev:turbo` | Same, using Turbopack instead of webpack |
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
src/modules/      business logic, one folder per domain (including the assistant tools)
src/lib/          database client, auth config, AI provider adapter, money and date helpers
src/proxy.ts      route protection (Next 16's proxy, formerly middleware)
src/components/   reusable UI components
src/generated/    Prisma Client output (generated, never edited)
prisma/           schema, migrations, seed script
tests/            unit and integration tests
docs/             the specification — read this before changing behaviour
backups/          local database backups (not committed)
```

## CI and CD

- `.github/workflows/ci.yml` runs typecheck, lint, the test suite, and a production build on
  every push to `main`, every pull request, and every `v*` tag.
- `.github/workflows/cd.yml` is a manual (or `v*` tag) deployment to the shop laptop through a
  self-hosted GitHub Actions runner. It verifies the release, builds, backs up the SQLite
  database, applies migrations, restarts the systemd service, and health-checks `/login`.
- `.github/workflows/vercel-preview.yml` deploys a Vercel preview for each pull request and
  keeps one PR comment updated with the link. Fork PRs are skipped so the token is not exposed.

CD prerequisites:

- a self-hosted runner with labels `self-hosted`, `linux`, and `shop-laptop`
- repository variable `DEPLOY_PATH` pointing at the live git checkout
- `.env` in that checkout with `DATABASE_URL` and `AUTH_SECRET`
- a systemd service named `ai-shopkeeper` (override with the `SERVICE_NAME` variable)
- passwordless sudo for `systemctl restart ai-shopkeeper`
- `curl` on the runner

The CD job is manual by default, so a shop laptop never redeploys while the shop is open. Run
it after closing time.

Vercel preview prerequisites:

- `VERCEL_TOKEN` repository secret
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` repository variables (required, so the CLI links to
  the existing Vercel project instead of creating a new one)
- `DATABASE_URL` and `AUTH_SECRET` in the Vercel project environment
- The app uses SQLite today, so a Vercel preview can build but data-backed screens will not
  work until a hosted database is added. Use previews for UI review.
- `.vercelignore` keeps `.env`, SQLite files, backups, tests, docs, and `.github` out of
  deployments.

## Documentation

The specification is the source of truth:

- `docs/project-overview.md` — scope, features, phases, success criteria
- `docs/architecture.md` — stack, boundaries, storage, auth, invariants
- `docs/code-standards.md` — how code must be written
- `docs/ui-context.md` — theme, tokens, components, layouts
- `docs/ai-workflow-rules.md` — how work is scoped and reported
- `docs/progress-tracker.md` — current phase, completed work, decisions

## Status

Phases 0–5.5 (the sellable v1) are complete: products and stock, sales, customers and credit,
dashboard and reports, expenses and net profit, voiding, an audit log, end-of-day cash
reconciliation, backups, and username/password sign-in. Phase 6 adds the read-only assistant.
154 tests pass.

Sign-in is required, and every money or stock change records the signed-in owner as the audit
actor. Next: Phase 7 — assistant actions.

## Sign-in and passwords

The seed creates one `OWNER` account from `.env`:

- `OWNER_USERNAME` (default `owner`)
- `OWNER_PASSWORD` (at least 8 characters)
- `OWNER_NAME` (display name, default `Shopkeeper`)

To change the owner password, edit `OWNER_PASSWORD` in `.env` and run `npm run db:seed` again.
The seed updates the hash and increments the user's `tokenVersion`, so existing sessions are
signed out. There is no in-app password screen yet; this needs access to the laptop.

## Assistant (optional)

Open **Assistant** from the dashboard or the **More** page. It answers English questions
about sales, stock, credit, expenses, profit, and expected cash using the shop's real
database figures. It is read-only: it cannot create, edit, void, or delete anything.

The assistant needs an OpenAI-compatible chat-completions endpoint. Add these to `.env` and
restart the app:

```bash
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="your-key"
AI_MODEL="gpt-4o-mini"
```

For Google Gemini's OpenAI-compatible endpoint:

```bash
AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
AI_API_KEY="your-key"
AI_MODEL="gemini-3.5-flash-lite"
```

Gemini returns a `thought_signature` with each tool call; the adapter sends it back unchanged so
multi-step tool use works. Free-tier Gemini models can be busy, so a lite model is a good
default.

For a fully local setup with [Ollama](https://ollama.com), no API key is needed:

```bash
AI_BASE_URL="http://localhost:11434/v1"
AI_MODEL="llama3.1"
```

Use a model that supports tool calling. OpenRouter, Groq, LM Studio, and other
OpenAI-compatible endpoints work the same way. If the three values are blank, the rest of the
app works normally and `/assistant` shows setup instructions.

The model never sees SQL and cannot call arbitrary functions. It can only use the approved,
Zod-validated read-only tools in `src/modules/assistant/tools.ts`. Each question is limited to
500 characters, four model turns, and eight tool calls.

**Privacy:** the question and the shop figures needed to answer it are sent to the configured
provider. Use a local Ollama model if the shop data must stay on the laptop. Chat history is
kept in the browser for the current page only; it is not saved to the database.

## Backups

The app makes one daily backup the first time the dashboard or `/backups` is opened each shop
day. **Back up now** on `/backups` makes an extra copy. Files live in `backups/` next to the
project. The last 30 daily backups are kept; manual backups are kept until you delete them.
Backups use SQLite's online backup API, so they are consistent while the app is running.

To restore:

1. Stop the app.
2. Copy the chosen `backups/*.db` file over `prisma/dev.db`.
3. Start the app and check the dashboard.

A backup on the same laptop does not survive theft or disk failure. Copy one to a USB drive or
another computer regularly.
