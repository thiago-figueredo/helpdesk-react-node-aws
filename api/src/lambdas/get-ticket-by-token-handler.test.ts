import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { CreateTicketResponseSchema, GetTicketByTokenResponseSchema } from "@yourname/helpdesk-shared";
import { setDown, setUp } from "../../test/db";
import { mockAwsEventBridgeSDK } from "../../test/mock-event-bridge";
import { createTicketHandler } from "./create-ticket-handler";
import { getTicketByTokenHandler } from "./get-ticket-by-token-handler";

mockAwsEventBridgeSDK();

function buildCreateTicketEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

function buildEvent(trackingToken: string): APIGatewayProxyEventV2 {
  return { pathParameters: { trackingToken } } as unknown as APIGatewayProxyEventV2;
}

function uniqueTenantName(): string {
  return `Acme Support ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("get-ticket-by-token", () => {
  beforeAll(setUp);
  afterAll(setDown);

  it("returns the ticket and its messages, oldest-first, for a valid trackingToken", async () => {
    const created = await createTicketHandler(
      buildCreateTicketEvent({
        tenantName: uniqueTenantName(),
        customerEmail: "jane@example.com",
        body: "Can't log in",
      }),
    );
    const createdResponse = CreateTicketResponseSchema.parse(JSON.parse(created.body));

    const result = await getTicketByTokenHandler(buildEvent(createdResponse.trackingToken));

    expect(result.statusCode).toBe(200);

    const response = GetTicketByTokenResponseSchema.parse(JSON.parse(result.body));

    expect(response).toEqual({
      ticket: createdResponse.ticket,
      messages: [
        {
          id: expect.any(String),
          senderType: "customer",
          body: "Can't log in",
          createdAt: expect.any(String),
        },
      ],
    });
  });

  it("rejects an unknown trackingToken with 404", async () => {
    const result = await getTicketByTokenHandler(buildEvent("00000000-0000-0000-0000-000000000000"));

    expect(result).toEqual({
      statusCode: 404,
      body: JSON.stringify({ error: "Ticket not found" }),
    });
  });
});
