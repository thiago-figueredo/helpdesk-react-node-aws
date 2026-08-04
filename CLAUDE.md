# Helpdesk

A one-week portfolio build of a multi-tenant support-ticketing SaaS. See `PRD.md`, `CONTEXT.md`, `docs/adr/`, and `docs/backend/design.md` for the full design.

## Conventions

- **Package manager: pnpm.** Use `pnpm install` / `pnpm --filter <workspace> <script>`, not `npm` or `yarn`. Workspaces are declared in `pnpm-workspace.yaml` (`api`, `shared`).
