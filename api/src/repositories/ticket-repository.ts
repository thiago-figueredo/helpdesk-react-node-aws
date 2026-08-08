import { db } from "../lib/prisma";
import { toDomain } from "../mappers/ticket-mapper";
import { toDomain as messageToDomain } from "../mappers/message-mapper";
import type { Ticket } from "../domain/ticket";
import type { Message } from "../domain/message";

export interface CreateTicketInput {
  tenantId: string;
  trackingToken: string;
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
};
