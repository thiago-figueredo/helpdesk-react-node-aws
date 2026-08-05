# Helpdesk

A one-week portfolio build of a multi-tenant support-ticketing SaaS. See `PRD.md`, `CONTEXT.md`, `docs/adr/`, and `docs/backend/design.md` for the full design.

## Conventions

- **Package manager: pnpm.** Use `pnpm install` / `pnpm --filter <workspace> <script>`, not `npm` or `yarn`. Workspaces are declared in `pnpm-workspace.yaml` (`api`, `shared`).
- **Lambda file naming: `<name>-handler.ts`.** Each Lambda's handler and test live flat in `api/src/lambdas/` as `<name>-handler.ts` / `<name>-handler.test.ts` (e.g. `signup-handler.ts`), not nested in a per-Lambda subdirectory with a generic `handler.ts` name.
- **Every Lambda uses a Service + Repository + Mapper — see ADR 0004.** No handler calls `prisma` directly. Flat, hyphenated, top-level folders parallel to `lambdas/`: `api/src/repositories/<entity>-repository.ts` (one per entity, shared across Lambdas), `api/src/services/<name>-service.ts` (one per Lambda, orchestrates Repository calls), `api/src/mappers/<entity>-mapper.ts` (`toDomain()` + `toResponseDto()`), `api/src/domain/` (domain types + `DomainError` subclasses). Built incrementally, test-driven — only for Lambdas that currently have a failing test, not pre-built ahead of the rest.
- **Every handler is wrapped in `withTransaction` — see ADR 0005.** `api/src/lib/with-transaction.ts` opens a Prisma interactive transaction around the entire handler body (uniformly, not just atomic actions) and maps thrown `DomainError`s to HTTP responses; handlers themselves have no try/catch. Repositories read the active client via `getDbClient()` (AsyncLocalStorage), not an explicit `tx` param — falls back to the plain `prisma` client if no transaction is active.
- **Test assertions: one `expect` on the whole object, not one per field, when possible.** Prefer `expect(body).toEqual({ ... })` over asserting each field separately.
