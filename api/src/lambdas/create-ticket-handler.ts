import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { CreateTicketRequestSchema } from "@yourname/helpdesk-shared";
import type { ApiResult } from "../lib/api-result";
import { withTransaction } from "../lib/with-transaction";
import { createTicket } from "../services/create-ticket-service";

export const createTicketHandler = withTransaction(
  async (event: APIGatewayProxyEventV2): Promise<ApiResult> => {
    const request = CreateTicketRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const response = await createTicket(request);

    return { statusCode: 201, body: JSON.stringify(response) };
  },
);
