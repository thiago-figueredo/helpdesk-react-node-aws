import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { LoginRequestSchema } from "@yourname/helpdesk-shared";
import type { ApiResult } from "../lib/api-result";
import { withTransaction } from "../lib/with-transaction";
import { login } from "../services/login-service";

export const loginHandler = withTransaction(
  async (event: APIGatewayProxyEventV2): Promise<ApiResult> => {
    const request = LoginRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const response = await login(request);

    return { statusCode: 200, body: JSON.stringify(response) };
  },
);
