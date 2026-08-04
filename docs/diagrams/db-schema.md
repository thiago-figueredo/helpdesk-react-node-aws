# Database schema

```mermaid
erDiagram
    TENANT ||--o{ USER : employs
    TENANT ||--o{ TICKET : owns
    TENANT ||--o{ NOTIFICATION : scopes
    USER ||--o{ TICKET : "claims (assignedAgentId)"
    USER ||--o{ NOTIFICATION : receives
    TICKET ||--o{ MESSAGE : contains

    TENANT {
        string id PK
        string name
        int slaHours "SLA threshold, default 4"
    }

    USER {
        string id PK
        string tenantId FK
        string email
        string passwordHash
        string role "admin | agent"
    }

    TICKET {
        string id PK
        string tenantId FK
        string assignedAgentId FK "nullable"
        string status "Open | InProgress | WaitingOnCustomer | Closed"
        string trackingToken UK "customer bearer token"
        datetime createdAt
        datetime lastTransitionAt "timestamp of last status change"
        int slaElapsedMs "accumulated as of lastTransitionAt"
        datetime slaBreachedAt "nullable, set once"
    }

    MESSAGE {
        string id PK
        string ticketId FK
        string senderType "agent | customer"
        string body
        datetime createdAt
    }

    NOTIFICATION {
        string id PK
        string tenantId FK
        string userId FK
        string type "new_ticket | reply | sla_breach"
        boolean read
        datetime createdAt
    }
```

`slaElapsedMs` + `lastTransitionAt` together implement the SLA formula from [`CONTEXT.md`](../../CONTEXT.md): current elapsed time = `slaElapsedMs + (now - lastTransitionAt)` while status is `Open`/`InProgress`, frozen otherwise.
