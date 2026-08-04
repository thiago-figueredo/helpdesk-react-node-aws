# Shared schema with `tenantId`, not schema-per-tenant

Helpdesk is a multi-tenant SaaS where each Tenant's data must stay isolated from every other Tenant's. We considered schema-per-tenant and database-per-tenant for stronger isolation, but both require dynamically provisioning and migrating N schemas/databases per signup — a real infra project on its own, and Prisma's multi-schema support is awkward.

We chose one Postgres database with one set of tables, where every tenant-scoped table (`Ticket`, `User`, `Message`, ...) carries a `tenantId` column. Isolation is enforced structurally via a Prisma Client Extension that injects the `tenantId` filter on every query, rather than trusting each handler to remember it by hand.

This is the pattern most real multi-tenant SaaS products run, and it's cheap to build within a one-week timeline. The realistic security story isn't "we used the strongest possible isolation" — it's "here's the specific mechanism that makes forgetting the tenant filter structurally hard, and why that's the failure mode that actually bites companies."

**Consequence:** the Prisma extension itself is now a single shared point of failure — a bug there would leak data across every tenant at once. This is why tenant-isolation is covered explicitly in the Jest test suite rather than left to manual testing.
