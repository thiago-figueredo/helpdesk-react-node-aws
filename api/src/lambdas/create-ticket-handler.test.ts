import { CreateTicketResponseSchema } from "@yourname/helpdesk-shared";
import { setDown, setUp, testPrisma } from "../../test/db";
import { buildEvent, uniqueTenantName } from "../../test/fixtures";
import { mockAwsEventBridgeSDK } from "../../test/mock-event-bridge";
import { createTicketHandler } from "./create-ticket-handler";

const sendEventToAWS = mockAwsEventBridgeSDK();

describe("create-ticket", () => {
  beforeAll(setUp);
  afterAll(setDown);
  beforeEach(() => sendEventToAWS.mockClear());

  it("creates a new Tenant, Ticket, and first Message for a brand-new tenantName", async () => {
    const tenantName = uniqueTenantName();
    const normalizedName = tenantName.toLowerCase();
    const customerEmail = "jane@example.com";

    const result = await createTicketHandler(
      buildEvent({ tenantName, customerEmail, body: "Can't log in" }),
    );

    expect(result.statusCode).toBe(201);

    const response = CreateTicketResponseSchema.parse(JSON.parse(result.body));

    expect(response).toEqual({
      trackingToken: expect.any(String),
      ticket: {
        id: expect.any(String),
        status: "Open",
        createdAt: expect.any(String),
      },
    });

    await expect("tenant").assertDatabaseHasOne({ name: normalizedName });
    await expect("user").assertDatabaseCount(0);

    await expect("ticket").assertDatabaseHasOne({
      id: response.ticket.id,
      status: "Open",
      trackingToken: response.trackingToken,
    });

    await expect("message").assertDatabaseHasOne({
      ticketId: response.ticket.id,
      senderType: "customer",
      senderEmail: customerEmail,
      body: "Can't log in",
    });
  });

  it("reuses an existing Tenant for a repeated tenantName instead of creating a duplicate", async () => {
    const tenantName = uniqueTenantName();
    const normalizedName = tenantName.toLowerCase();

    const first = await createTicketHandler(
      buildEvent({
        tenantName,
        customerEmail: "jane@example.com",
        body: "First ticket",
      }),
    );
    const firstResponse = CreateTicketResponseSchema.parse(
      JSON.parse(first.body),
    );

    const second = await createTicketHandler(
      buildEvent({
        tenantName: ` ${tenantName.toUpperCase()} `,
        customerEmail: "bob@example.com",
        body: "Second ticket",
      }),
    );
    const secondResponse = CreateTicketResponseSchema.parse(
      JSON.parse(second.body),
    );

    expect(secondResponse.ticket.id).not.toBe(firstResponse.ticket.id);

    await expect("tenant").assertDatabaseCount({ name: normalizedName }, 1);

    const tenant = await testPrisma.tenant.findUniqueOrThrow({
      where: { name: normalizedName },
    });
    await expect("ticket").assertDatabaseCount({ tenantId: tenant.id }, 2);
  });

  it("publishes ticket.created to EventBridge", async () => {
    const tenantName = uniqueTenantName();

    const result = await createTicketHandler(
      buildEvent({
        tenantName,
        customerEmail: "jane@example.com",
        body: "Can't log in",
      }),
    );
    const response = CreateTicketResponseSchema.parse(JSON.parse(result.body));

    const ticket = await testPrisma.ticket.findUniqueOrThrow({
      where: { id: response.ticket.id },
    });

    expect(sendEventToAWS).toHaveBeenCalledTimes(1);

    const command = sendEventToAWS.mock.calls[0][0].input;
    expect(command.Entries).toHaveLength(1);
    expect(command.Entries[0]).toEqual({
      Source: "helpdesk",
      DetailType: "ticket.created",
      Detail: expect.any(String),
    });
    expect(JSON.parse(command.Entries[0].Detail)).toEqual({
      ticketId: ticket.id,
      tenantId: ticket.tenantId,
    });
  });
});
