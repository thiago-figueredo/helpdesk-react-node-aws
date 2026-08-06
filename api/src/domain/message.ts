import type { SenderType } from "@prisma/client";

export interface Message {
  id: string;
  ticketId: string;
  senderType: SenderType;
  senderEmail: string | null;
  body: string;
  createdAt: Date;
}
