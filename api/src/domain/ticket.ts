import type { TicketStatus } from "@prisma/client";

export interface Ticket {
  id: string;
  tenantId: string;
  assignedAgentId: string | null;
  status: TicketStatus;
  trackingToken: string;
  createdAt: Date;
  lastTransitionAt: Date;
  slaElapsedMs: number;
  slaBreachedAt: Date | null;
}
