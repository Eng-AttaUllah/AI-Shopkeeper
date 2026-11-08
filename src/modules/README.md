# Modules

Business logic lives here, one folder per domain. Screens and route handlers
call into these modules; they never contain business rules themselves.

Each domain folder exposes three files:

| File | Responsibility |
| ---- | -------------- |
| `schema.ts` | Zod schemas and inferred types for validated input |
| `service.ts` | Mutations and business rules (owns transactions and invariants) |
| `queries.ts` | Read-only database queries used by screens and reports |

Planned domains: `products`, `sales`, `customers`, `shops` (Phase 13: signup, membership,
search, and join requests), `reports`, `expenses`, `cash`, and `assistant`. See
`docs/architecture.md`. Every function here takes the shop id it operates on — tenant
isolation is Invariant 13.
