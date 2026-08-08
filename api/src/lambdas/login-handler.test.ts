import jwt from "jsonwebtoken";
import { LoginResponseSchema } from "@yourname/helpdesk-shared";
import { setDown, setUp } from "../../test/db";
import { buildEvent, uniqueEmail, uniqueTenantName } from "../../test/fixtures";
import { signupHandler } from "./signup-handler";
import { loginHandler } from "./login-handler";
import { Role } from "@prisma/client";

describe("login", () => {
  beforeAll(setUp);
  afterAll(setDown);

  it("returns a token and correct claims for valid credentials", async () => {
    const email = uniqueEmail("agent");
    const password = "supersecret123";
    const tenantName = uniqueTenantName();

    const signup = await signupHandler(
      buildEvent({ email, password, tenantName }),
    );

    const signupBody = JSON.parse(signup.body);

    const result = await loginHandler(buildEvent({ email, password }));

    expect(result.statusCode).toBe(200);

    const response = LoginResponseSchema.parse(JSON.parse(result.body));

    expect(response).toEqual({
      token: expect.any(String),
      user: { id: signupBody.user.id, email, role: "admin" },
      tenant: { id: signupBody.tenant.id, name: tenantName.toLowerCase() },
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
      buildEvent({ email: uniqueEmail("agent"), password: "supersecret123" }),
    );

    expect(result).toEqual({
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid email or password" }),
    });
  });

  it("rejects a wrong password with the same 401 as an unknown email", async () => {
    const email = uniqueEmail("agent");

    await signupHandler(
      buildEvent({
        email,
        password: "supersecret123",
        tenantName: uniqueTenantName(),
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
