import type { APIGatewayProxyEventV2 } from "aws-lambda";

export function uniqueTenantName(): string {
  return `Acme Support ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export function buildEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}
