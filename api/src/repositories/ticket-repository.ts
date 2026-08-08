import type { Ticket as PrismaTicket, TicketStatus } from "@prisma/client";
import { db } from "../lib/prisma";
import { toDomain } from "../mappers/ticket-mapper";
import { toDomain as messageToDomain } from "../mappers/message-mapper";
import type { Ticket } from "../domain/ticket";
import type { Message } from "../domain/message";

export interface CreateTicketInput {
  tenantId: string;
  trackingToken: string;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  assignedAgentId?: string;
  lastTransitionAt?: Date;
  slaElapsedMs?: number;
}

export const ticketRepository = {
  async create(input: CreateTicketInput): Promise<Ticket> {
    const ticket = await db().ticket.create({ data: input });
    return toDomain(ticket);
  },

  async findByTrackingTokenWithMessages(
    trackingToken: string,
  ): Promise<{ ticket: Ticket; messages: Message[] } | null> {
    const ticket = await db().ticket.findUnique({
      where: { trackingToken },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) return null;

    const { messages, ...ticketFields } = ticket;
    return {
      ticket: toDomain(ticketFields),
      messages: messages.map(messageToDomain),
    };
  },

  async findForUpdate(id: string, tenantId: string): Promise<Ticket | null> {
    const [ticket] = await db().$queryRaw<PrismaTicket[]>`
      SELECT * FROM "Ticket" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE
    `;
    return ticket ? toDomain(ticket) : null;
  },

  async findForUpdateByTrackingToken(trackingToken: string): Promise<Ticket | null> {
    const [ticket] = await db().$queryRaw<PrismaTicket[]>`
      SELECT * FROM "Ticket" WHERE "trackingToken" = ${trackingToken} FOR UPDATE
    `;
    return ticket ? toDomain(ticket) : null;
  },

  async update(id: string, input: UpdateTicketInput): Promise<Ticket> {
    const ticket = await db().ticket.update({ where: { id }, data: input });
    return toDomain(ticket);
  },
};
