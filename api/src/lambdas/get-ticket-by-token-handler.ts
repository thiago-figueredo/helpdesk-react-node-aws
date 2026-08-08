import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetTicketByTokenRequestSchema } from "@yourname/helpdesk-shared";
import type { ApiResult } from "../lib/api-result";
import { withTransaction } from "../lib/with-transaction";
import { getTicketByToken } from "../services/get-ticket-by-token-service";

export const getTicketByTokenHandler = withTransaction(
  async (event: APIGatewayProxyEventV2): Promise<ApiResult> => {
    const request = GetTicketByTokenRequestSchema.parse(event.pathParameters ?? {});
    const response = await getTicketByToken(request);

    return { statusCode: 200, body: JSON.stringify(response) };
  },
);
