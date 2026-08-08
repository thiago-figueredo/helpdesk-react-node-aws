import { SenderType, TicketStatus } from "@prisma/client";
import { ReplyToTicketResponseSchema } from "@yourname/helpdesk-shared";
import { setDown, setUp, testPrisma } from "../../test/db";
import { mockAwsEventBridgeSDK } from "../../test/mock-event-bridge";
import { replyToTicketHandler } from "./reply-to-ticket-handler";
import { buildAgentEvent, buildCustomerEvent, createAgent, createTicketFixture } from "./reply-to-ticket-handler.test-utils";

const sendEventToAWS = mockAwsEventBridgeSDK();

describe("reply-to-ticket", () => {
  beforeAll(setUp);
  afterAll(setDown);
  beforeEach(() => sendEventToAWS.mockClear());

  describe("Agent path", () => {
    it("transitions InProgress to WaitingOnCustomer and creates an agent Message", async () => {
      const { ticketId, tenantId } = await createTicketFixture();
      const agentId = await createAgent(tenantId);

      const lastTransitionAt = new Date(Date.now() - 5000);
      await testPrisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.InProgress,
          assignedAgentId: agentId,
          lastTransitionAt,
          slaElapsedMs: 1000,
        },
      });

      sendEventToAWS.mockClear();

      const result = await replyToTicketHandler(
        buildAgentEvent(ticketId, { userId: agentId, tenantId }, { body: "We're looking into it" }),
      );

      expect(result.statusCode).toBe(201);

      const response = ReplyToTicketResponseSchema.parse(JSON.parse(result.body));

      expect(response).toEqual({
        ticket: { id: ticketId, status: "WaitingOnCustomer", createdAt: expect.any(String) },
        message: {
          id: expect.any(String),
          senderType: "agent",
          body: "We're looking into it",
          createdAt: expect.any(String),
        },
      });

      await expect("ticket").assertDatabaseHasOne({ id: ticketId, status: TicketStatus.WaitingOnCustomer });
      await expect("message").assertDatabaseHasOne({
        ticketId,
        senderType: SenderType.agent,
        senderEmail: null,
        body: "We're looking into it",
      });

      const updatedTicket = await testPrisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      const minExpectedElapsed = 1000 + (Date.now() - lastTransitionAt.getTime());
      expect(updatedTicket.slaElapsedMs).toBeGreaterThanOrEqual(1000 + 5000);
      expect(updatedTicket.slaElapsedMs).toBeLessThanOrEqual(minExpectedElapsed);

      expect(sendEventToAWS).toHaveBeenCalledTimes(1);
      const command = sendEventToAWS.mock.calls[0][0].input;
      expect(command.Entries[0]).toEqual({
        Source: "helpdesk",
        DetailType: "ticket.replied",
        Detail: expect.any(String),
      });
      expect(JSON.parse(command.Entries[0].Detail)).toEqual({
        ticketId,
        tenantId,
        senderType: "agent",
      });
    });

    it("rejects a reply when the ticket isn't InProgress with 409", async () => {
      const { ticketId, tenantId } = await createTicketFixture();
      const agentId = await createAgent(tenantId);

      await testPrisma.ticket.update({
        where: { id: ticketId },
        data: { assignedAgentId: agentId },
      });

      const result = await replyToTicketHandler(
        buildAgentEvent(ticketId, { userId: agentId, tenantId }, { body: "We're looking into it" }),
      );

      expect(result).toEqual({
        statusCode: 409,
        body: JSON.stringify({ error: "Ticket status is Open, expected InProgress." }),
      });
    });

    it("rejects a cross-tenant ticket ID with 404", async () => {
      const { ticketId } = await createTicketFixture();
      const other = await createTicketFixture();
      const agentId = await createAgent(other.tenantId);

      const result = await replyToTicketHandler(
        buildAgentEvent(ticketId, { userId: agentId, tenantId: other.tenantId }, { body: "We're looking into it" }),
      );

      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ error: "Ticket not found" }),
      });
    });

    it("rejects a same-tenant Agent who isn't the assigned agent with 403", async () => {
      const { ticketId, tenantId } = await createTicketFixture();
      const assignedAgentId = await createAgent(tenantId);
      const otherAgentId = await createAgent(tenantId);

      await testPrisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.InProgress, assignedAgentId },
      });

      const result = await replyToTicketHandler(
        buildAgentEvent(ticketId, { userId: otherAgentId, tenantId }, { body: "We're looking into it" }),
      );

      expect(result).toEqual({
        statusCode: 403,
        body: JSON.stringify({ error: "You are not the assigned agent for this ticket" }),
      });
    });
  });

  describe("Customer path", () => {
    it("transitions WaitingOnCustomer to InProgress and creates a customer Message, resuming the SLA clock", async () => {
      const { ticketId, trackingToken } = await createTicketFixture();

      const lastTransitionAt = new Date(Date.now() - 5000);
      await testPrisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.WaitingOnCustomer, lastTransitionAt, slaElapsedMs: 1000 },
      });

      sendEventToAWS.mockClear();
      const before = Date.now();

      const result = await replyToTicketHandler(
        buildCustomerEvent(trackingToken, { body: "Still stuck, tried that already" }),
      );

      expect(result.statusCode).toBe(201);

      const response = ReplyToTicketResponseSchema.parse(JSON.parse(result.body));

      expect(response).toEqual({
        ticket: { id: ticketId, status: "InProgress", createdAt: expect.any(String) },
        message: {
          id: expect.any(String),
          senderType: "customer",
          body: "Still stuck, tried that already",
          createdAt: expect.any(String),
        },
      });

      await expect("ticket").assertDatabaseHasOne({ id: ticketId, status: TicketStatus.InProgress });
      await expect("message").assertDatabaseHasOne({
        ticketId,
        senderType: SenderType.customer,
        senderEmail: null,
        body: "Still stuck, tried that already",
      });

      const updatedTicket = await testPrisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      expect(updatedTicket.slaElapsedMs).toBe(1000);
      expect(updatedTicket.lastTransitionAt.getTime()).toBeGreaterThanOrEqual(before);

      expect(sendEventToAWS).toHaveBeenCalledTimes(1);
      const command = sendEventToAWS.mock.calls[0][0].input;
      expect(JSON.parse(command.Entries[0].Detail)).toEqual({
        ticketId,
        tenantId: updatedTicket.tenantId,
        senderType: "customer",
      });
    });

    it("rejects an unknown trackingToken with 404", async () => {
      const result = await replyToTicketHandler(
        buildCustomerEvent("00000000-0000-0000-0000-000000000000", { body: "hello" }),
      );

      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ error: "Ticket not found" }),
      });
    });

    it("rejects a reply when the ticket isn't WaitingOnCustomer, including Closed, with 409", async () => {
      const { ticketId, trackingToken } = await createTicketFixture();

      await testPrisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.Closed },
      });

      const result = await replyToTicketHandler(buildCustomerEvent(trackingToken, { body: "hello" }));

      expect(result).toEqual({
        statusCode: 409,
        body: JSON.stringify({ error: "Ticket status is Closed, expected WaitingOnCustomer." }),
      });
    });
  });

  describe("concurrency", () => {
    it("serializes simultaneous Agent and Customer replies via the row lock instead of corrupting state", async () => {
      const { ticketId, tenantId, trackingToken } = await createTicketFixture();
      const agentId = await createAgent(tenantId);

      const lastTransitionAt = new Date(Date.now() - 5000);
      await testPrisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.InProgress,
          assignedAgentId: agentId,
          lastTransitionAt,
          slaElapsedMs: 1000,
        },
      });

      const [agentResult, customerResult] = await Promise.all([
        replyToTicketHandler(buildAgentEvent(ticketId, { userId: agentId, tenantId }, { body: "Agent reply" })),
        replyToTicketHandler(buildCustomerEvent(trackingToken, { body: "Customer reply" })),
      ]);

      // Agent's InProgress precondition always matches the ticket's starting state, so it always
      // succeeds. Customer's precondition (WaitingOnCustomer) only matches once Agent's write has
      // committed, so the lock forces exactly one of two valid, non-corrupted outcomes: either the
      // Customer's SELECT ... FOR UPDATE was blocked until after Agent committed and it legitimately
      // chains into a second transition, or it read the still-InProgress row first and cleanly 409s.
      // What the lock rules out is a lost update: both transactions reading stale InProgress state
      // concurrently and racing an inconsistent write.
      expect(agentResult.statusCode).toBe(201);
      expect([201, 409]).toContain(customerResult.statusCode);

      const messageCount = await testPrisma.message.count({ where: { ticketId } });
      const finalTicket = await testPrisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

      // messageCount includes the fixture's original customer Message from createTicketFixture.
      if (customerResult.statusCode === 201) {
        expect(messageCount).toBe(3);
        expect(finalTicket.status).toBe(TicketStatus.InProgress);
      } else {
        expect(customerResult.body).toBe(
          JSON.stringify({ error: "Ticket status is InProgress, expected WaitingOnCustomer." }),
        );
        expect(messageCount).toBe(2);
        expect(finalTicket.status).toBe(TicketStatus.WaitingOnCustomer);
      }

      expect(finalTicket.slaElapsedMs).toBeGreaterThanOrEqual(1000 + 5000);
    });
  });
});
