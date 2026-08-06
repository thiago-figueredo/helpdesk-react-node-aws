import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { SignupResponseSchema } from "@yourname/helpdesk-shared";
import { setDown, setUp, testPrisma } from "../../test/db";
import { tenantRepository } from "../repositories/tenant-repository";
import { signupHandler } from "./signup-handler";

function buildEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
}

function uniqueEmail(): string {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function uniqueTenantName(): string {
  return `Acme Support ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("signup", () => {
  beforeAll(setUp);
  afterAll(setDown);

  it("creates a Tenant and Admin User, returning a token", async () => {
    const email = uniqueEmail();
    const tenantName = uniqueTenantName();

    const result = await signupHandler(
      buildEvent({
        email,
        password: "supersecret123",
        tenantName,
      }),
    );

    expect(result.statusCode).toBe(201);

    const response = SignupResponseSchema.parse(JSON.parse(result.body));
    const normalizedName = tenantName.toLowerCase();

    expect(response).toEqual({
      token: expect.any(String),
      user: { id: expect.any(String), email, role: "admin" },
      tenant: { id: expect.any(String), name: normalizedName },
    });

    await expect("tenant").assertDatabaseHasOne({
      id: response.tenant.id,
      name: normalizedName,
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
    const secondTenantName = uniqueTenantName();

    const first = await signupHandler(
      buildEvent({
        email,
        password: "supersecret123",
        tenantName: uniqueTenantName(),
      }),
    );
    expect(first.statusCode).toBe(201);

    const second = await signupHandler(
      buildEvent({
        email,
        password: "different-password-1",
        tenantName: secondTenantName,
      }),
    );

    expect(second).toEqual({
      statusCode: 409,
      body: JSON.stringify({ error: "Email already in use" }),
    });

    await expect("user").assertDatabaseHasOne({ email });

    await expect("tenant").assertNotInDatabase({
      name: secondTenantName.toLowerCase(),
    });
  });

  it("stores a hashed password, never the plaintext", async () => {
    const email = uniqueEmail();
    const password = "supersecret123";

    const result = await signupHandler(
      buildEvent({ email, password, tenantName: uniqueTenantName() }),
    );
    const response = SignupResponseSchema.parse(JSON.parse(result.body));

    const user = await testPrisma.user.findUnique({
      where: { id: response.user.id },
    });

    expect(user?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("adopts an existing Tenant with zero Users instead of creating a duplicate", async () => {
    const tenantName = uniqueTenantName();
    const normalizedName = tenantName.toLowerCase();

    const created = await tenantRepository.getOrCreate(normalizedName);

    const result = await signupHandler(
      buildEvent({
        email: uniqueEmail(),
        password: "supersecret123",
        tenantName,
      }),
    );

    expect(result.statusCode).toBe(201);

    const response = SignupResponseSchema.parse(JSON.parse(result.body));

    expect(response.tenant.id).toBe(created.id);

    await expect("tenant").assertDatabaseCount({ name: normalizedName }, 1);
  });

  it("rejects signup under a tenantName already claimed by another Admin with 409", async () => {
    const tenantName = uniqueTenantName();

    const first = await signupHandler(
      buildEvent({
        email: uniqueEmail(),
        password: "supersecret123",
        tenantName,
      }),
    );
    expect(first.statusCode).toBe(201);

    const second = await signupHandler(
      buildEvent({
        email: uniqueEmail(),
        password: "different-password-1",
        tenantName,
      }),
    );

    expect(second).toEqual({
      statusCode: 409,
      body: JSON.stringify({ error: "Tenant name already taken" }),
    });

    await expect("user").assertDatabaseCount(
      { tenantId: JSON.parse(first.body).tenant.id },
      1,
    );
  });
});
