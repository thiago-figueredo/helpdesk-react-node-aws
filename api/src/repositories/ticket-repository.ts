import { db } from "../lib/prisma";
import { toDomain } from "../mappers/ticket-mapper";
import type { Ticket } from "../domain/ticket";

export interface CreateTicketInput {
  tenantId: string;
  trackingToken: string;
}

export const ticketRepository = {
  async create(input: CreateTicketInput): Promise<Ticket> {
    const ticket = await db().ticket.create({ data: input });
    return toDomain(ticket);
  },
};
