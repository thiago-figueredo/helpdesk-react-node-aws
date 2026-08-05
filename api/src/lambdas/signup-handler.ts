import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { SignupRequestSchema } from "@yourname/helpdesk-shared";
import type { ApiResult } from "../lib/api-result";
import { withTransaction } from "../lib/with-transaction";
import { signup } from "../services/signup-service";

export const signupHandler = withTransaction(
  async (event: APIGatewayProxyEventV2): Promise<ApiResult> => {
    const request = SignupRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const response = await signup(request);

    return { statusCode: 201, body: JSON.stringify(response) };
  },
);
