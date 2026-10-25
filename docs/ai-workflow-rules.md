# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. The files in `docs/` define
what to build, how to build it, and the current state of progress. Always implement against
these specs. Do not infer, invent, or "improve" behaviour that the specs do not describe.

Read order before any task:

1. `AGENTS.md` (repository root)
2. `docs/project-overview.md`
3. `docs/architecture.md`
4. `docs/progress-tracker.md`
5. `docs/code-standards.md` and `docs/ui-context.md`

## Scoping Rules

- Work on one feature unit at a time, in the order defined by the implementation phases.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.
- Never start a later phase while an earlier phase has unfinished or failing work.
- Do not build anything listed under Out of Scope in `project-overview.md`.

## When to Split Work

Split an implementation step if it combines:

- Database schema changes and UI work.
- UI changes and background or scheduled work (backups, scheduled jobs).
- More than one domain module (`sales` and `customers`, for example).
- Multiple unrelated route handlers or screens.
- Behaviour that is not clearly defined in the context files.

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behaviour that the context files do not define.
- If a requirement is ambiguous, resolve it in the relevant context file first, and record
  the decision under Architecture Decisions in `progress-tracker.md`.
- If a requirement is missing, add it as an Open Question in `progress-tracker.md` and stop
  before implementing it.
- If two documents disagree, `architecture.md` wins for structure and invariants,
  `project-overview.md` wins for scope, and the conflict is recorded as an open question.

## Protected Files

Do not modify the following unless explicitly instructed:

- `src/components/ui/*` — shadcn/ui generated components.
- `prisma/migrations/*` — committed migrations. Add a new migration instead.
- Anything inside `node_modules/` or other third-party library internals.
- `docs/ai-workflow-rules.md` — these rules themselves.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture, boundaries, or invariants → `architecture.md`
- Storage model or data decisions → `architecture.md`
- Code conventions → `code-standards.md`
- Visual language, tokens, or components → `ui-context.md`
- Feature scope, phases, or success criteria → `project-overview.md`
- Anything completed, in progress, or decided → `progress-tracker.md`

If a change requires a new document, add it to `docs/` and reference it from `AGENTS.md`.

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope.
2. No invariant defined in `architecture.md` was violated.
3. `progress-tracker.md` reflects the completed work.
4. `npm run build` passes.
5. `npm test` passes, including the tests that cover the changed invariants.
6. Any new decision is recorded, and any resolved open question is removed.

## Reporting Back

At the end of a unit, report in plain language:

- What now works that did not work before.
- What was deliberately not built.
- Any new open question or decision.
- The exact command the user can run to see it.

Do not claim something works without having run it.
