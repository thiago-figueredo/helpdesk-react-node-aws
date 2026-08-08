import { SenderType, type TicketStatus } from "@prisma/client";
import type { ReplyToTicketResponse } from "@yourname/helpdesk-shared";
import { NotAssignedAgentError, TicketNotFoundError, TicketStatusConflictError } from "../domain/errors";
import type { Ticket } from "../domain/ticket";
import { publish } from "../lib/event-bus";
import { toResponseDto as messageToResponseDto } from "../mappers/message-mapper";
import { toResponseDto as ticketToResponseDto } from "../mappers/ticket-mapper";
import { messageRepository } from "../repositories/message-repository";
import { ticketRepository } from "../repositories/ticket-repository";

export interface ReplyToTicketAsAgentInput {
  ticketId: string;
  tenantId: string;
  agentId: string;
  body: string;
}

export interface ReplyToTicketAsCustomerInput {
  trackingToken: string;
  body: string;
}

export async function replyToTicketAsAgent(
  input: ReplyToTicketAsAgentInput,
): Promise<ReplyToTicketResponse> {
  const ticket = await ticketRepository.findForUpdate(input.ticketId, input.tenantId);
  if (!ticket) throw new TicketNotFoundError();
  if (ticket.assignedAgentId !== input.agentId) throw new NotAssignedAgentError();

  return transitionAndReply(ticket, {
    expectedStatus: "InProgress",
    newStatus: "WaitingOnCustomer",
    senderType: SenderType.agent,
    body: input.body,
  });
}

export async function replyToTicketAsCustomer(
  input: ReplyToTicketAsCustomerInput,
): Promise<ReplyToTicketResponse> {
  const ticket = await ticketRepository.findForUpdateByTrackingToken(input.trackingToken);
  if (!ticket) throw new TicketNotFoundError();

  return transitionAndReply(ticket, {
    expectedStatus: "WaitingOnCustomer",
    newStatus: "InProgress",
    senderType: SenderType.customer,
    body: input.body,
  });
}

async function transitionAndReply(
  ticket: Ticket,
  options: { expectedStatus: TicketStatus; newStatus: TicketStatus; senderType: SenderType; body: string },
): Promise<ReplyToTicketResponse> {
  if (ticket.status !== options.expectedStatus) {
    throw new TicketStatusConflictError(ticket.status, options.expectedStatus);
  }

  const now = new Date();
  const wasCountable = ticket.status === "Open" || ticket.status === "InProgress";
  const elapsedSinceLastTransition = now.getTime() - ticket.lastTransitionAt.getTime();

  const updatedTicket = await ticketRepository.update(ticket.id, {
    status: options.newStatus,
    lastTransitionAt: now,
    slaElapsedMs: wasCountable ? ticket.slaElapsedMs + elapsedSinceLastTransition : ticket.slaElapsedMs,
  });

  const message = await messageRepository.create({
    ticketId: ticket.id,
    senderType: options.senderType,
    body: options.body,
  });

  await publish("ticket.replied", {
    ticketId: ticket.id,
    tenantId: ticket.tenantId,
    senderType: options.senderType,
  });

  return {
    ticket: ticketToResponseDto(updatedTicket),
    message: messageToResponseDto(message),
  };
}
