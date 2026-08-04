# Helpdesk

A multi-tenant support ticketing system where companies (Tenants) manage customer support requests (Tickets) through their support staff (Agents/Admins), with anonymous customers participating via a tokenized link rather than an account.

## Language

**Tenant**:
A company using the helpdesk to manage its own customer support. Owns its Users and Tickets; no Tenant can see another Tenant's data.
_Avoid_: Organization, company, account

**Admin**:
A User role that owns a Tenant, can invite/manage Agents, and can perform everything an Agent can.
_Avoid_: Owner, manager

**Agent**:
A User role belonging to a Tenant who claims and works Tickets. Does not manage other Users.
_Avoid_: Employee, support rep, staff

**Customer**:
The person who submitted a Ticket. Has no account or login; identified only by the Ticket's tokenized tracking link.
_Avoid_: User, client, requester

**Ticket**:
A single customer support request, scoped to one Tenant, with a status and a thread of Messages.
_Avoid_: Issue, case, request

**Message**:
A single entry in a Ticket's thread, sent by either an Agent or the Customer. The sender of the most recent Message determines whose turn it is to act.
_Avoid_: Reply, comment, note

**Ticket status**:
- **Open**: Created, not yet claimed by an Agent.
- **In Progress**: Claimed by an Agent, or reopened by a Customer Message. The SLA clock runs during this state.
- **Waiting on Customer**: An Agent has replied and is waiting on the Customer's next Message. The SLA clock is paused during this state.
- **Closed**: Resolved; no further action expected.
_Avoid_: Pending, on hold, resolved, in review

**SLA elapsed time**:
The total wall-clock duration a Ticket has spent in Open or In Progress, summed across all such intervals (including the current one, if still ongoing) since creation. Time spent Waiting on Customer or after Closed does not count.
_Avoid_: Response time, age

**SLA breach**:
The event fired when a Ticket's SLA elapsed time exceeds the tenant's threshold, detected by a periodic scheduled check rather than by any single Message. Fires exactly once per Ticket, recorded via `slaBreachedAt`.
_Avoid_: Timeout, overdue

**SLA threshold**:
The per-Tenant maximum SLA elapsed time (`Tenant.slaHours`) before a Ticket is considered breached.
_Avoid_: SLA target, response time limit

**Tracking token**:
An unguessable random string issued to a Ticket at creation, giving its Customer passwordless access to view and reply to that one Ticket. Not an identity credential — a bearer capability scoped to a single Ticket.
_Avoid_: Access token, magic link, session token
