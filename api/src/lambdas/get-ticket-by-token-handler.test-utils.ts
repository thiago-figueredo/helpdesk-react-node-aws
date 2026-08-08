import type { APIGatewayProxyEventV2 } from "aws-lambda";

export function buildGetTicketByTokenEvent(trackingToken: string): APIGatewayProxyEventV2 {
  return { pathParameters: { trackingToken } } as unknown as APIGatewayProxyEventV2;
}
