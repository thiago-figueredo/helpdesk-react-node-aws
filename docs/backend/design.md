# Backend design

Precedes implementation. Covers every API route, the auth model, the Zod contract convention, the Ticket status-transition mechanism, and the Jest integration test plan. Nothing here should be implemented until this doc is confirmed.

Assumes familiarity with `CONTEXT.md` (domain glossary), `PRD.md` (flow/entities), and `docs/adr/` (multi-tenancy, Neon).

## API routes

| Method + path | Lambda | Auth | Status |
|---|---|---|---|
| `POST /auth/signup` | `signup` | Public | ✅ |
| `POST /auth/login` | `login` | Public | ✅ |
| `POST /tickets` | `create-ticket` | Public | ✅ |
| `GET /customers/tickets/:trackingToken` | `get-ticket-by-token` | Public — `trackingToken` validated in-handler | ✅ |
| `POST /customers/tickets/:trackingToken/messages` | `reply-to-ticket` (shared) | Public — `trackingToken` validated in-handler | ✅ |
| `GET /tickets` | `list-tickets` | JWT + Authorizer | |
| `GET /tickets/:id` | `get-ticket` | JWT + Authorizer | |
| `POST /tickets/:id/claim` | `claim-ticket` | JWT + Authorizer | |
| `POST /tickets/:id/messages` | `reply-to-ticket` (shared) | JWT + Authorizer | ✅ |
| `POST /tickets/:id/close` | `close-ticket` | JWT + Authorizer | |
| `POST /agents` | `invite-agent` | JWT + Authorizer, Admin role only | |
| `GET /notifications` | `list-notifications` | JWT + Authorizer | |
| `POST /notifications/:id/read` | `mark-notification-read` | JWT + Authorizer | |

Non-HTTP:

| Lambda | Trigger | Status |
|---|---|---|
| `check-sla-breaches` | EventBridge scheduled rule, `rate(15 minutes)` | |
| `send-email-notification` | SQS Email queue | |
| `send-inapp-notification` | SQS In-App queue | |
| `lambda-authorizer` | API Gateway custom authorizer, attached per-route to every JWT-protected route above | |

17 Lambdas total.

`reply-to-ticket` is one Lambda backing two routes — it checks whether `event.requestContext.authorizer` is populated (Agent path) or falls back to the `trackingToken` in the path (Customer path), then shares message-creation and status-transition logic either way.

## Authentication & authorization

- **Agent/Admin**: hand-rolled JWT (email/password), verified by `lambda-authorizer`, attached to each protected route individually (no route-prefix grouping). `lambda-authorizer` attaches `{ userId, tenantId, role }` — all strings, field-for-field matching `TokenClaims` from `lib/auth.ts` — as `event.requestContext.authorizer.lambda` on the downstream request. Until `lambda-authorizer` itself is built, every JWT-protected Lambda's tests fabricate that context object directly rather than running real JWT verification (see "Auth in tests" below).
- **Customer**: no account. `trackingToken` is a bearer capability for one Ticket, validated inside the handler itself — it never goes through the Authorizer, since it isn't a JWT and carries no claims to verify.
- **Cross-tenant resource access**: any tenant-scoped lookup by ID (`get-ticket`, `claim-ticket`, `close-ticket`, `reply-to-ticket` Agent path, `mark-notification-read`) that resolves to a different tenant's row returns **404**, not 403 — indistinguishable from not existing, so a response never confirms a given ID belongs to *some* tenant.
- **Same-tenant ownership**: `reply-to-ticket` Agent path additionally requires the caller to be the ticket's `assignedAgentId`. Unlike cross-tenant access, the ticket's existence within the caller's own tenant isn't secret (it's visible via `list-tickets`), so a wrong-Agent reply returns **403** (`NotAssignedAgentError`), not 404.

## Request/response contracts

One `<Action>RequestSchema` / `<Action>ResponseSchema` Zod pair per route (e.g. `ClaimTicketRequestSchema`), defined in `@yourname/helpdesk-shared`. Handlers parse the incoming body/params through the request schema at the top of the function (reject on failure before touching the DB); the same schemas are imported by `helpdesk-web` for typed API calls, so the contract only has one definition.

## Application layering (Service / Repository / Mapper)

**See ADR 0004.** No Lambda talks to Prisma directly. The Service owns orchestration; entity-scoped Repositories (`UserRepository`, `TenantRepository`, `TicketRepository`, `MessageRepository`, `NotificationRepository`) own persistence and translate Prisma-specific failures into `DomainError`s; Mappers translate between Prisma rows, Domain objects, and the Zod DTOs from `@yourname/helpdesk-shared`.

**See ADR 0005.** Transactions and error mapping are not the Service's concern. Every Lambda handler is wrapped, uniformly, by a shared `withTransaction` decorator (`api/src/lib/with-transaction.ts`) that opens a Prisma interactive transaction around the entire handler body — request parsing, Service/Repository calls, and any external I/O (EventBridge, SES) alike — and stores the active client in an `AsyncLocalStorage` context for that call's duration. Repositories read the active client via `db()` instead of taking an explicit `tx` param, falling back to the plain `prisma` client if no transaction is active. `withTransaction` also maps thrown `DomainError`s to HTTP responses via `api/src/lib/error-response.ts`, catching outside the `$transaction` callback so a `DomainError` rolls back the transaction before being converted to a response — handlers themselves have no try/catch. The `SELECT ... FOR UPDATE` mechanism in "Atomic update mechanism" below is expressed this way: inside a ticket-transition handler wrapped by `withTransaction`, the Service calls `ticketRepository.findForUpdate(id)`, checks the precondition, then calls `ticketRepository.update(...)` and `messageRepository.create(...)` — both resolving the same active `tx` via `db()`.

Layering is built incrementally, one Lambda at a time, only once that Lambda has a failing test driving it — not pre-built ahead of the rest.

## Status-transition logic

Every transition enforces a **strict state guard**: a Lambda only accepts its one documented precondition state and rejects (409) otherwise. No implicit claim-on-reply, no reopening a `Closed` ticket via a stale `trackingToken` link — matches the "no AI/NLP, simple state machine" scope already locked in PRD.md, and keeps every transition testable as a single precondition → postcondition pair.

| Transition | Precondition | Actor |
|---|---|---|
| `Open` → `InProgress` | `status = Open` | Agent claims |
| `InProgress` → `WaitingOnCustomer` | `status = InProgress`, caller is `assignedAgentId` | Agent replies |
| `WaitingOnCustomer` → `InProgress` | `status = WaitingOnCustomer` | Customer replies |
| `InProgress`/`WaitingOnCustomer` → `Closed` | not already `Closed` | Agent closes |

### Atomic update mechanism

The naive read-then-write (read `Ticket`, compute `wasCountable`/`elapsedSinceLastTransition` in application memory, then write `status` + `lastTransitionAt` + conditional `slaElapsedMs`) is a non-atomic read-modify-write: a concurrent transition on the same Ticket between the read and the write makes the computed elapsed-time wrong, regardless of how the final write is expressed.

Prisma's atomic `increment` alone does **not** fix this — it only atomically computes the new value of `slaElapsedMs` from the DB's current value, but the *decision* of whether to increment at all, and by how much, still depends on `status`/`lastTransitionAt` read earlier into application memory.

**Decision: every status-transition write locks the row with `SELECT ... FOR UPDATE`** inside the transaction `withTransaction` (ADR 0005) already has open for the handler, re-reads fresh state under the lock, computes, writes:

```ts
// ticket-repository.ts — reads the active tx via db(), per ADR 0005
async findForUpdate(id: string, tenantId: string): Promise<Ticket | null> {
  const [ticket] = await db().$queryRaw<Ticket[]>`
    SELECT * FROM "Ticket" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE
  `;
  return ticket ? toDomain(ticket) : null;
}

// claim-ticket-service.ts — no $transaction here; withTransaction already opened one
const ticket = await ticketRepository.findForUpdate(id, tenantId);
if (!ticket) throw new NotFoundError();
if (ticket.status !== expectedStatus) throw new ConflictError();

const wasCountable = ticket.status === 'Open' || ticket.status === 'InProgress';
const elapsedSinceLastTransition = now - ticket.lastTransitionAt;

await ticketRepository.update(id, {
  status: newStatus,
  lastTransitionAt: now,
  slaElapsedMs: wasCountable ? ticket.slaElapsedMs + elapsedSinceLastTransition : ticket.slaElapsedMs,
});
```

Rejected alternatives: optimistic concurrency (`updateMany` gated on the previously-read `lastTransitionAt`, retry on 0 rows affected) avoids holding a lock but adds retry-loop code for a race that, given single-agent-per-ticket traffic, will essentially never fire; plain `increment` is insufficient per above. Not written up as an ADR — reversible later without much cost, recorded here instead.

## Tenant resolution for `create-ticket`

**See ADR 0006.** `create-ticket` is public and unauthenticated, so it can't resolve a `tenantId` from a JWT or path param — instead the request carries `tenantName`, and `TenantRepository.getOrCreate` resolves it via `db().tenant.upsert({ where: { name }, update: {}, create: { name } })`, where `name` is passed in already trim+lowercase-normalized. `Tenant.name` is `@unique` on that normalized value — one column, no separate raw-casing field, so original display casing is never preserved. `upsert` resolves concurrent get-or-create races on a brand-new name atomically via the unique constraint itself; no explicit `SELECT ... FOR UPDATE` is needed here, unlike the SLA transition mechanism below, because there's no read-computed-write step.

A Tenant created this way has zero `User`s ("unclaimed" — see `CONTEXT.md`) until an Admin signs up under the same (normalized) name. `signup` therefore uses the same `getOrCreate` lookup rather than always inserting a new row: if the resolved Tenant has zero Users, the new Admin is attached to it (claiming it); if it already has ≥1 User, signup rejects with a new `TenantNameTakenError` (409).

The Customer's email for a Ticket lives on `Message.senderEmail` (nullable, set only on the Ticket's first/customer-authored Message) rather than as a `Ticket` column — anything needing "the Ticket's customer email" (e.g. `send-email-notification`) queries for the Ticket's first Message, not its latest customer Message, since `reply-to-ticket`'s Customer path never re-supplies it.

## `reply-to-ticket` mechanics

One Lambda backs both routes (see "API routes"), dispatching on whether `event.requestContext.authorizer.lambda` is populated (Agent path) or absent (Customer path, falls back to the `trackingToken` path param).

- **Lookup**: the Agent path locks via `ticketRepository.findForUpdate(id, tenantId)` (see "Atomic update mechanism"). The Customer path has no `id`/`tenantId` in hand — only `trackingToken` — so it locks via a separate `ticketRepository.findForUpdateByTrackingToken(trackingToken)`. Both do their own `SELECT ... FOR UPDATE`.
- **Service structure**: `reply-to-ticket-service.ts` exports `replyToTicketAsAgent()` and `replyToTicketAsCustomer()`, each resolving its own row and expected-status precondition, both calling a shared unexported `transitionAndReply()` that performs the lock-scoped write, `Message` creation, and event publish.
- **Contract**: one shared `ReplyToTicketRequestSchema` (`{ body }`) covers the payload for both routes — path params (`trackingToken` or `id`) are parsed per-branch in the handler, not part of the Zod contract. One shared `ReplyToTicketResponseSchema` (`{ ticket, message }`), since the response shape is identical either way. Returns `201`.
- **`senderEmail`**: never set on a reply-created Message, Agent or Customer path alike — only `create-ticket`'s first Message sets it (see "Tenant resolution for `create-ticket`" above).
- **Event**: publishes `ticket.replied` with `{ ticketId, tenantId, senderType }`, reusing the existing `SenderType` enum so downstream consumers can filter by who authored the reply — `send-email-notification` acts on an Agent-authored (customer-facing) reply, `send-inapp-notification` acts on a Customer-authored (agent-facing) reply.
- **Errors**: `TicketStatusConflictError` — `409`, constructed as `new TicketStatusConflictError(actual, expected)` where `expected: TicketStatus | TicketStatus[]`, message `` `Ticket status is ${actual}, expected ${expected}.` `` (or `expected one of ${expected.join(", ")}` for an array) — is the shared precondition-conflict error for every transition Lambda, not just this one. `NotAssignedAgentError` — `403` — is specific to the Agent path's ownership check.

## Jest integration test plan

### Test infrastructure

- **Database**: Dockerized Postgres for tests (Neon stays the prod target). Reset via unique, randomized fixtures per test (fresh Tenant/User/Ticket via a `createTestTenant()`-style factory) rather than per-test truncation; one truncate-all in `beforeAll`/`afterAll` per test file.
- **Invocation**: every Lambda's test imports the handler and calls it directly with a hand-built event object (`APIGatewayProxyEventV2`, `SQSEvent`, or the EventBridge scheduled-event shape, as appropriate) — no API Gateway/SQS emulation.
- **Auth in tests**: `lambda-authorizer` has its own dedicated suite covering JWT verification. Every other Agent-authenticated Lambda's tests fabricate `event.requestContext.authorizer.lambda` directly with whatever identity the test needs, rather than re-running real JWT verification per test.
- **Layering is refactored in under the handler-level integration test, not separately unit-tested.** Extracting a Lambda's Service/Repository/Mapper (ADR 0004) is the refactor step of red-green-refactor under that Lambda's already-green `<name>-handler.test.ts` — no dedicated `*-service.test.ts` or `*-repository.test.ts` files. Prefer one `expect` against the whole returned/persisted object over one `expect` per field where possible.
- **Database assertions use Laravel-style custom Jest matchers**, defined in `api/test/matchers.ts` (`expect.extend` + the `declare global { namespace jest {...} } }` type augmentation live in the same file, wired via `setupFilesAfterEnv`): `expect(tableName).assertDatabaseHas(criteria)` (≥1 match), `assertDatabaseHasOne(criteria)` (exactly 1 match), `assertDatabaseCount(count)` / `assertDatabaseCount(criteria, count)`, `assertNotInDatabase(criteria)` (0 matches). `tableName` is typed `Uncapitalize<Prisma.ModelName>`, matching `testPrisma`'s delegate names. All are async — callers must `await` them. On failure they re-query the table (capped at 5 rows) and print the actual rows alongside the expected criteria.

### Per-Lambda behaviors

**Auth**
- `lambda-authorizer` — valid JWT → allow + correct `tenantId`/`userId`/`role` in context; expired JWT → deny; malformed/bad-signature JWT → deny; missing header → deny
- `signup` — valid, new tenant name → creates Tenant + Admin, returns JWT; valid, name matches an existing zero-User Tenant → claims it (attaches Admin to that row, no duplicate created); name already claimed by another Admin → 409 (`TenantNameTakenError`); duplicate email → rejected; stored `passwordHash` isn't plaintext
- `login` — valid creds → JWT with correct claims; wrong password → 401; unknown email → same 401 (no user enumeration)
- `invite-agent` — Admin inviting → creates Agent scoped to Admin's tenant with the given temp password; non-admin Agent attempting to invite → 403; duplicate email in-tenant → rejected

**Tickets**
- `create-ticket` — valid submission, new `tenantName` → creates Tenant (zero Users) + Ticket(`Open`) + first Message(`customer`, `senderEmail` set) + unique `trackingToken`; valid submission, `tenantName` matches an existing Tenant → reuses that Tenant, doesn't create a duplicate; publishes `ticket.created` to EventBridge (assert the PutEvents call, EventBridge client mocked)
- `get-ticket-by-token` — valid `trackingToken` → ticket + its messages, oldest-first (`createdAt` asc); unknown `trackingToken` → 404 (`TicketNotFoundError`)
- `list-tickets` — tenant isolation: a second tenant's tickets never appear in the caller's results; status/assignment filters work
- `get-ticket` — returns own-tenant ticket + messages; cross-tenant ticket ID → 404
- `claim-ticket` — `Open`→`InProgress`, `assignedAgentId` set, SLA elapsed correctly accumulated up to claim time; two simultaneous claims on the same ticket → exactly one succeeds, the other 409s (direct test of the `SELECT ... FOR UPDATE` mechanism); claiming a non-`Open` ticket → 409
- `reply-to-ticket` (Agent path) — `InProgress`→`WaitingOnCustomer`, Message(`agent`), `ticket.replied` published, SLA accumulation correct; wrong precondition state → 409; cross-tenant ticket ID → 404; replying Agent is not `assignedAgentId` → 403 (`NotAssignedAgentError`)
- `reply-to-ticket` (Customer path) — `WaitingOnCustomer`→`InProgress`, Message(`customer`), `ticket.replied` published, SLA resumes; invalid `trackingToken` → 404; wrong precondition state (including `Closed`) → 409; concurrent Agent+Customer reply on the same ticket → lock correctness (second atomicity test)
- `close-ticket` — any open state → `Closed`, SLA elapsed frozen from that point forward; already-`Closed` → 409

**Notifications**
- `list-notifications` — scoped to caller's own `userId` + tenant
- `mark-notification-read` — marks own notification; another user's notification → 404

**Event-driven**
- `send-email-notification` — `ticket.created` / customer-facing `ticket.replied` → correct SES call (SES client mocked)
- `send-inapp-notification` — `ticket.created` → Notification for every Agent in tenant; agent-facing `ticket.replied` → Notification for assigned Agent; `ticket.sla_breached` → Notification for Admin(s)
- `check-sla-breaches` — over-threshold + countable + `slaBreachedAt IS NULL` → sets it, fires event; already-breached → not re-fired (exactly-once); under-threshold → untouched; time spent `WaitingOnCustomer` → correctly excluded even if wall-clock-old; uses each Tenant's own `slaHours`
