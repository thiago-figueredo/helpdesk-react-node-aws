import type { GetTicketByTokenRequest, GetTicketByTokenResponse } from "@yourname/helpdesk-shared";
import { TicketNotFoundError } from "../domain/errors";
import { toResponseDto as ticketToResponseDto } from "../mappers/ticket-mapper";
import { toResponseDto as messageToResponseDto } from "../mappers/message-mapper";
import { ticketRepository } from "../repositories/ticket-repository";

export async function getTicketByToken(
  input: GetTicketByTokenRequest,
): Promise<GetTicketByTokenResponse> {
  const result = await ticketRepository.findByTrackingTokenWithMessages(
    input.trackingToken,
  );
  if (!result) throw new TicketNotFoundError();

  return {
    ticket: ticketToResponseDto(result.ticket),
    messages: result.messages.map(messageToResponseDto),
  };
}
