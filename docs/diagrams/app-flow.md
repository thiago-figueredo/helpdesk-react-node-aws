# App / event flow

```mermaid
flowchart TD
    Cust([Customer - browser])
    Ag([Agent / Admin - browser])

    Cust -->|"1 Submit ticket (public form)"| APIGW[API Gateway HTTP API]
    Ag -->|"Login / Claim / Reply"| APIGW
    APIGW --> Authz[[Lambda Authorizer]]

    APIGW --> CreateTicket[create-ticket Lambda]
    APIGW --> ClaimTicket[claim-ticket Lambda]
    APIGW --> Reply[reply-to-ticket Lambda]

    CreateTicket --> DB[(Postgres - Neon)]
    ClaimTicket --> DB
    Reply --> DB

    CreateTicket -->|"2 ticket.created"| EB{{EventBridge Bus}}
    Reply -->|"4/5 ticket.replied"| EB

    Schedule([EventBridge Scheduled Rule<br/>rate 15 min]) --> SLA[check-sla-breaches Lambda]
    SLA --> DB
    SLA -->|"6 ticket.sla_breached"| EB

    EB --> EmailQ[/SQS Email Queue/]
    EB --> InAppQ[/SQS In-App Queue/]

    EmailQ --> EmailLambda[send-email-notification Lambda]
    EmailLambda --> SES[[Amazon SES]]
    SES -.->|confirmation / reply email w/ tracking link| Cust

    InAppQ --> InAppLambda[send-inapp-notification Lambda]
    InAppLambda --> DB

    EmailQ -.->|failed after retries| DLQ1[[DLQ - Email]]
    InAppQ -.->|failed after retries| DLQ2[[DLQ - In-App]]

    Ag -->|"poll for notifications"| APIGW
```

Numbers in the flow labels correspond to the step numbers in [PRD.md § End-to-end flow](../../PRD.md#end-to-end-flow). Steps 3 (claim) and 7 (close) intentionally have no arrows into EventBridge — no event is fired for either, per that decision.
