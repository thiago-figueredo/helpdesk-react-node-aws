# User email is globally unique, not scoped per Tenant

`signup` creates a brand-new Tenant on every call, so a `tenantId`-scoped unique constraint on `User.email` can never reject a duplicate signup — the two rows would always land under different `tenantId`s. To make "duplicate email → rejected" an enforceable, race-safe guarantee (not an app-level pre-check with a TOCTOU window), `User.email` is now unique globally: one email can be an Admin or Agent of exactly one Tenant, ever. This also lets `login` look up a `User` by email alone, with no tenant-selection step.

**Consequences:** a person who wants to belong to two separate Tenants needs two separate email addresses — this is a deliberate deviation from the more common "same email, multiple tenant memberships" SaaS pattern, chosen for one-week-build simplicity. Reversing it later means a schema migration plus a product decision about how to handle any already-colliding data.
