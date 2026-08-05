import type { LoginRequest, LoginResponse } from "@yourname/helpdesk-shared";
import { comparePassword, signToken } from "../lib/auth";
import { InvalidCredentialsError, TenantNotFoundError } from "../domain/errors";
import { toResponseDto as tenantToResponseDto } from "../mappers/tenant-mapper";
import { toResponseDto as userToResponseDto } from "../mappers/user-mapper";
import { tenantRepository } from "../repositories/tenant-repository";
import { userRepository } from "../repositories/user-repository";

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const user = await userRepository.findByEmail(input.email);
  if (!user) throw new InvalidCredentialsError();

  const passwordMatches = await comparePassword(
    input.password,
    user.passwordHash,
  );
  if (!passwordMatches) throw new InvalidCredentialsError();

  const tenant = await tenantRepository.findById(user.tenantId);
  if (!tenant) throw new TenantNotFoundError();

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
