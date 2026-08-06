import { Role } from "@prisma/client";
import type { SignupRequest, SignupResponse } from "@yourname/helpdesk-shared";
import { TenantNameTakenError } from "../domain/errors";
import { hashPassword, signToken } from "../lib/auth";
import { normalizeTenantName } from "../lib/normalize-tenant-name";
import { toResponseDto as tenantToResponseDto } from "../mappers/tenant-mapper";
import { toResponseDto as userToResponseDto } from "../mappers/user-mapper";
import { tenantRepository } from "../repositories/tenant-repository";
import { userRepository } from "../repositories/user-repository";

export async function signup(input: SignupRequest): Promise<SignupResponse> {
  const passwordHash = await hashPassword(input.password);

  const tenant = await tenantRepository.getOrCreate(
    normalizeTenantName(input.tenantName),
    input.slaHours,
  );

  const alreadyClaimed = await userRepository.existsForTenant(tenant.id);
  if (alreadyClaimed) throw new TenantNameTakenError();

  const user = await userRepository.create({
    tenantId: tenant.id,
    email: input.email,
    passwordHash,
    role: Role.admin,
  });

  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  return {
    token,
    user: userToResponseDto(user),
    tenant: tenantToResponseDto(tenant),
  };
}
