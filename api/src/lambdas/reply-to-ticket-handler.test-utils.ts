import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { Role } from "@prisma/client";
import { CreateTicketResponseSchema } from "@yourname/helpdesk-shared";
import { testPrisma } from "../../test/db";
import { uniqueEmail, uniqueTenantName } from "../../test/fixtures";
import { createTicketHandler } from "./create-ticket-handler";

export async function createTicketFixture(): Promise<{ ticketId: string; tenantId: string; trackingToken: string }> {
  const created = await createTicketHandler({
    body: JSON.stringify({
      tenantName: uniqueTenantName(),
      customerEmail: "jane@example.com",
      body: "Can't log in",
    }),
  } as APIGatewayProxyEventV2);
  const response = CreateTicketResponseSchema.parse(JSON.parse(created.body));
  const ticket = await testPrisma.ticket.findUniqueOrThrow({ where: { id: response.ticket.id } });

  return { ticketId: ticket.id, tenantId: ticket.tenantId, trackingToken: ticket.trackingToken };
}

export async function createAgent(tenantId: string): Promise<string> {
  const agent = await testPrisma.user.create({
    data: { tenantId, email: uniqueEmail("agent"), passwordHash: "hash", role: Role.agent },
  });
  return agent.id;
}

export function buildAgentEvent(
  ticketId: string,
  auth: { userId: string; tenantId: string },
  body: unknown,
): APIGatewayProxyEventV2 {
  return {
    body: JSON.stringify(body),
    pathParameters: { id: ticketId },
    requestContext: {
      authorizer: { lambda: { userId: auth.userId, tenantId: auth.tenantId, role: "agent" } },
    },
  } as unknown as APIGatewayProxyEventV2;
}

export function buildCustomerEvent(trackingToken: string, body: unknown): APIGatewayProxyEventV2 {
  return {
    body: JSON.stringify(body),
    pathParameters: { trackingToken },
    requestContext: {},
  } as unknown as APIGatewayProxyEventV2;
}
