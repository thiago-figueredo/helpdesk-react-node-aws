import { randomUUID } from "node:crypto";
import { SenderType } from "@prisma/client";
import type { CreateTicketRequest, CreateTicketResponse } from "@yourname/helpdesk-shared";
import { publish } from "../lib/event-bus";
import { normalizeTenantName } from "../lib/normalize-tenant-name";
import { toResponseDto as ticketToResponseDto } from "../mappers/ticket-mapper";
import { messageRepository } from "../repositories/message-repository";
import { ticketRepository } from "../repositories/ticket-repository";
import { tenantRepository } from "../repositories/tenant-repository";

export async function createTicket(
  input: CreateTicketRequest,
): Promise<CreateTicketResponse> {
  const tenant = await tenantRepository.getOrCreate(
    normalizeTenantName(input.tenantName),
  );

  const ticket = await ticketRepository.create({
    tenantId: tenant.id,
    trackingToken: randomUUID(),
  });

  await messageRepository.create({
    ticketId: ticket.id,
    senderType: SenderType.customer,
    senderEmail: input.customerEmail,
    body: input.body,
  });

  await publish("ticket.created", { ticketId: ticket.id, tenantId: tenant.id });

  return {
    trackingToken: ticket.trackingToken,
    ticket: ticketToResponseDto(ticket),
  };
}
