# Modules

Business logic lives here, one folder per domain. Screens and route handlers
call into these modules; they never contain business rules themselves.

Each domain folder exposes three files:

| File | Responsibility |
| ---- | -------------- |
| `schema.ts` | Zod schemas and inferred types for validated input |
| `service.ts` | Mutations and business rules (owns transactions and invariants) |
| `queries.ts` | Read-only database queries used by screens and reports |

Planned domains: `products`, `sales`, `customers`, `reports`, `expenses`, and
later `assistant`. See `docs/architecture.md`.
