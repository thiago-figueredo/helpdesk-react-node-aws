import type { APIGatewayProxyEventV2 } from "aws-lambda";
import jwt from "jsonwebtoken";
import { LoginResponseSchema } from "@yourname/helpdesk-shared";
import { setDown, setUp } from "../../test/db";
import { signupHandler } from "./signup-handler";
import { loginHandler } from "./login-handler";
import { Role } from "@prisma/client";

function buildEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

function uniqueEmail(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe("login", () => {
  beforeAll(setUp);
  afterAll(setDown);

  it("returns a token and correct claims for valid credentials", async () => {
    const email = uniqueEmail();
    const password = "supersecret123";

    const signup = await signupHandler(
      buildEvent({ email, password, tenantName: "Acme Support" }),
    );

    const signupBody = JSON.parse(signup.body);

    const result = await loginHandler(buildEvent({ email, password }));

    expect(result.statusCode).toBe(200);

    const response = LoginResponseSchema.parse(JSON.parse(result.body));

    expect(response).toEqual({
      token: expect.any(String),
      user: { id: signupBody.user.id, email, role: "admin" },
      tenant: { id: signupBody.tenant.id, name: "Acme Support" },
    });

    const claims = jwt.verify(response.token, process.env.JWT_SECRET as string);

    expect(claims).toMatchObject({
      userId: signupBody.user.id,
      tenantId: signupBody.tenant.id,
      role: Role.admin,
    });
  });

  it("rejects an unknown email with 401", async () => {
    const result = await loginHandler(
      buildEvent({ email: uniqueEmail(), password: "supersecret123" }),
    );

    expect(result).toEqual({
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid email or password" }),
    });
  });

  it("rejects a wrong password with the same 401 as an unknown email", async () => {
    const email = uniqueEmail();

    await signupHandler(
      buildEvent({
        email,
        password: "supersecret123",
        tenantName: "Acme Support",
      }),
    );

    const result = await loginHandler(
      buildEvent({ email, password: "wrong-password" }),
    );

    expect(result).toEqual({
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid email or password" }),
    });
  });
});
