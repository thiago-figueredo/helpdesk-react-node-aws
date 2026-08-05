import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { SignupResponseSchema } from "@yourname/helpdesk-shared";
import { testPrisma, truncateAll } from "../../test/db";
import { handler } from "./signup-handler";

function buildEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

function uniqueEmail(): string {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe("signup", () => {
  beforeAll(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await truncateAll();
    await testPrisma.$disconnect();
  });

  it("creates a Tenant and Admin User, returning a token", async () => {
    const email = uniqueEmail();

    const result = await handler(
      buildEvent({
        email,
        password: "supersecret123",
        tenantName: "Acme Support",
      }),
    );

    expect(result.statusCode).toBe(201);

    const response = SignupResponseSchema.parse(JSON.parse(result.body));

    expect(response).toEqual({
      token: expect.any(String),
      user: { id: expect.any(String), email, role: "admin" },
      tenant: { id: expect.any(String), name: "Acme Support" },
    });

    await expect("tenant").assertDatabaseHasOne({
      id: response.tenant.id,
      name: "Acme Support",
      slaHours: 4,
    });

    await expect("user").assertDatabaseHasOne({
      id: response.user.id,
      tenantId: response.tenant.id,
      role: "admin",
    });
  });

  it("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail();

    const first = await handler(
      buildEvent({
        email,
        password: "supersecret123",
        tenantName: "Acme Support",
      }),
    );
    expect(first.statusCode).toBe(201);

    const second = await handler(
      buildEvent({
        email,
        password: "different-password-1",
        tenantName: "Someone Else's Company",
      }),
    );

    expect(second).toEqual({
      statusCode: 409,
      body: JSON.stringify({ error: "Email already in use" }),
    });

    await expect("user").assertDatabaseHasOne({ email });

    await expect("tenant").assertNotInDatabase({
      name: "Someone Else's Company",
    });
  });

  it("stores a hashed password, never the plaintext", async () => {
    const email = uniqueEmail();
    const password = "supersecret123";

    const result = await handler(
      buildEvent({ email, password, tenantName: "Acme Support" }),
    );
    const response = SignupResponseSchema.parse(JSON.parse(result.body));

    const user = await testPrisma.user.findUnique({
      where: { id: response.user.id },
    });

    expect(user?.passwordHash).toMatch(/^\$2[aby]\$/);
  });
});
