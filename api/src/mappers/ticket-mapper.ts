import type { Ticket as PrismaTicket } from "@prisma/client";
import type { TicketDto } from "@yourname/helpdesk-shared";
import type { Ticket } from "../domain/ticket";

export function toDomain(ticket: PrismaTicket): Ticket {
  return {
    id: ticket.id,
    tenantId: ticket.tenantId,
    assignedAgentId: ticket.assignedAgentId,
    status: ticket.status,
    trackingToken: ticket.trackingToken,
    createdAt: ticket.createdAt,
    lastTransitionAt: ticket.lastTransitionAt,
    slaElapsedMs: ticket.slaElapsedMs,
    slaBreachedAt: ticket.slaBreachedAt,
  };
}

export function toResponseDto(ticket: Ticket): TicketDto {
  return {
    id: ticket.id,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
  };
}
