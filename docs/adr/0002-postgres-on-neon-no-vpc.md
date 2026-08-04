# Postgres on Neon, no VPC (skip RDS-in-VPC)

Lambda functions need to reach Postgres. RDS is the "default" AWS choice, but it requires Lambda to run inside a VPC to reach it privately — which then requires a NAT Gateway (or per-service VPC endpoints) for those same Lambdas to reach other AWS services (SES, EventBridge) or the public internet.

We chose to host Postgres on Neon (serverless Postgres, reachable over plain TCP/TLS from any network) and keep every Lambda outside a VPC entirely.

VPC/NAT/security-group configuration is a well-known source of debugging time on serverless projects, and none of it appears in the target job description, which asks for Prisma + Postgres knowledge, not VPC networking. Given a one-week build with no prior serverless experience, removing this entire class of risk was worth more than matching the "textbook AWS" RDS setup. Neon's Prisma support is first-class and its free tier comfortably covers a portfolio project's traffic.

**Consequence:** at real production scale, RDS/Aurora with connection pooling (RDS Proxy) is the more standard choice — this decision is specific to the constraints of a one-week solo build, not a claim that it's the right call at scale. Worth stating explicitly if asked "would you do this in production."
