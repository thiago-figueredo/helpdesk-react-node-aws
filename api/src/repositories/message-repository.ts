import { SenderType } from "@prisma/client";
import { db } from "../lib/prisma";
import { toDomain } from "../mappers/message-mapper";
import type { Message } from "../domain/message";

export interface CreateMessageInput {
  ticketId: string;
  senderType: SenderType;
  senderEmail?: string;
  body: string;
}

export const messageRepository = {
  async create(input: CreateMessageInput): Promise<Message> {
    const message = await db().message.create({ data: input });
    return toDomain(message);
  },
};
