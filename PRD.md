# Helpdesk — PRD

A one-week portfolio build of a multi-tenant support-ticketing SaaS, scoped to prove hands-on AWS serverless (Lambda, API Gateway, SQS, EventBridge), TypeScript, React, Prisma/Postgres, and testing skills for an upcoming interview.

Domain terms below assume familiarity with `CONTEXT.md`.

## Actors

- **Admin** — owns a Tenant, self-serve signup, invites Agents.
- **Agent** — belongs to a Tenant, claims and works Tickets. No customer-management permissions.
- **Customer** — anonymous, no account. Identified only by a Ticket's Tracking Token.

## Entities

- **Tenant**: `id`, `name`, `slaHours` (SLA threshold, default 4).
- **User**: `id`, `tenantId`, `email`, `passwordHash`, `role` (`admin` | `agent`).
- **Ticket**: `id`, `tenantId`, `status`, `assignedAgentId` (nullable), `trackingToken` (unique), `slaBreachedAt` (nullable), status-transition timestamps.
- **Message**: `id`, `ticketId`, `senderType` (`agent` | `customer`), `body`, `createdAt`.
- **Notification**: `id`, `tenantId`, `userId`, `type`, `read`, `createdAt` (in-app only).

## Ticket lifecycle

`Open` → (Agent claims) → `In Progress` → (Agent replies) → `Waiting on Customer` → (Customer replies) → `In Progress` → ... → (Agent closes) → `Closed`

SLA elapsed time accumulates only during `Open`/`In Progress`; pauses during `Waiting on Customer`; stops permanently at `Closed`. See `CONTEXT.md` for exact definitions.

## End-to-end flow

1. **Onboarding** — Admin signs up (email/password) → creates Tenant + Admin User, issues JWT. Admin invites Agents.
2. **Ticket created** — Customer submits public form (no login) → `create-ticket` Lambda writes Ticket + first Message + `trackingToken` → publishes `ticket.created` to EventBridge → fans out to SQS Email queue (SES confirmation + tracking link) and SQS In-App queue (notifies all Agents of new Unassigned ticket).
3. **Claim** — Agent claims from the Unassigned queue → `assignedAgentId` set, `status=InProgress`. No event fired.
4. **Agent replies** — writes Message, `status=WaitingOnCustomer` → publishes `ticket.replied` → Email queue notifies Customer.
5. **Customer replies** — via Tracking Token link → writes Message, `status=InProgress` → publishes `ticket.replied` → In-App queue notifies assigned Agent.
6. **SLA breach check** — EventBridge scheduled rule (`rate(15 minutes)`) invokes `check-sla-breaches` Lambda → for every open/in-progress Ticket with `slaBreachedAt IS NULL`, computes elapsed time vs. `Tenant.slaHours` → on breach, sets `slaBreachedAt` and publishes `ticket.sla_breached` (fires exactly once) → In-App queue notifies Admin.
7. **Close** — Agent sets `status=Closed`. No event fired.

## Tech stack

| Layer | Choice | Why (see ADRs for the two flagged) |
|---|---|---|
| IaC | AWS CDK (TypeScript) | Infra-as-TypeScript, matches the rest of the stack |
| Local/dev workflow | Deploy to a real AWS free-tier account, no LocalStack | Avoids emulation-fidelity risk while learning CDK + EventBridge/SQS simultaneously |
| Database | Postgres on Neon, no VPC | **ADR 0002** |
| Multi-tenancy | Shared schema, `tenantId` column, enforced via Prisma Client Extension | **ADR 0001** |
| API | API Gateway HTTP API (v2) | Cheaper, simpler, sufficient feature set |
| Auth | Hand-rolled JWT (email/password), custom Lambda Authorizer at API Gateway | Self-issued tokens, no OIDC provider, so the built-in JWT authorizer doesn't apply |
| Lambda granularity | One Lambda per business action, shared CDK factory helper | Least-privilege IAM per function, literal SRP example |
| Frontend state | Context API (auth/session only) + React Query (server data: tickets, messages, notifications) | Avoids re-render anti-pattern of putting frequently-changing data in Context |
| UI | Material UI | Per JD |
| Repo structure | Separate repos (`helpdesk-web`, `helpdesk-api`) + shared package (`@yourname/helpdesk-shared` on GitHub Packages: TS types + Zod schemas, contract-only, no Prisma client) | Independently deployable services with a versioned shared contract |
| Testing | Jest (not Vitest, matches JD) + React Testing Library + Cypress (one full happy-path e2e) + Jest integration tests for every Lambda, including async consumers and the scheduled SLA checker | Full-flow Cypress can't reach the async/scheduled Lambdas — those need direct handler-level tests |
| CI | None for v1 (run tests locally) | Time-boxed decision given the one-week budget |
| Notifications | SES (email, customer-facing) + DB-backed in-app notifications (agent-facing) | Matches "no customer login" constraint |

## Diagrams

- [Database schema](docs/diagrams/db-schema.md)
- [App / event flow](docs/diagrams/app-flow.md)

## Explicitly out of scope for v1

- OAuth login (stretch goal only, JWT is the baseline)
- Business-hours-aware SLA clock (wall-clock only)
- Ticket priority levels / per-priority SLA thresholds
- Auto-assignment (round robin)
- `ticket.claimed` event/notification
- CI pipeline
