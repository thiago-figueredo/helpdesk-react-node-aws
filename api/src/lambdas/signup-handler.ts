import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { SignupRequestSchema } from "@yourname/helpdesk-shared";
import { withTransaction } from "../lib/with-transaction";
import { signup } from "../services/signup-service";

interface Result {
  statusCode: number;
  body: string;
}

export const handler = withTransaction(
  async (event: APIGatewayProxyEventV2): Promise<Result> => {
    const request = SignupRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const response = await signup(request);

    return { statusCode: 201, body: JSON.stringify(response) };
  },
);
