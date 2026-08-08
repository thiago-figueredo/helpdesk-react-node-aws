import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ReplyToTicketRequestSchema } from "@yourname/helpdesk-shared";
import type { ApiResult } from "../lib/api-result";
import { withTransaction } from "../lib/with-transaction";
import { replyToTicketAsAgent, replyToTicketAsCustomer } from "../services/reply-to-ticket-service";

interface AgentAuthorizerContext {
  userId: string;
  tenantId: string;
  role: string;
}

type ReplyToTicketEvent = APIGatewayProxyEventV2 & {
  requestContext: APIGatewayProxyEventV2["requestContext"] & {
    authorizer?: { lambda: AgentAuthorizerContext };
  };
};

export const replyToTicketHandler = withTransaction(
  async (event: ReplyToTicketEvent): Promise<ApiResult> => {
    const request = ReplyToTicketRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const auth = event.requestContext.authorizer?.lambda;

    const response = auth
      ? await replyToTicketAsAgent({
          ticketId: event.pathParameters?.id ?? "",
          tenantId: auth.tenantId,
          agentId: auth.userId,
          body: request.body,
        })
      : await replyToTicketAsCustomer({
          trackingToken: event.pathParameters?.trackingToken ?? "",
          body: request.body,
        });

    return { statusCode: 201, body: JSON.stringify(response) };
  },
);
