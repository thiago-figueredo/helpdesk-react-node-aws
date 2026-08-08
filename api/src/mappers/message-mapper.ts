import type { Message as PrismaMessage } from "@prisma/client";
import type { MessageDto } from "@yourname/helpdesk-shared";
import type { Message } from "../domain/message";

export function toDomain(message: PrismaMessage): Message {
  return {
    id: message.id,
    ticketId: message.ticketId,
    senderType: message.senderType,
    senderEmail: message.senderEmail,
    body: message.body,
    createdAt: message.createdAt,
  };
}

export function toResponseDto(message: Message): MessageDto {
  return {
    id: message.id,
    senderType: message.senderType,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}
