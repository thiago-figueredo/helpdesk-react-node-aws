import type { User as PrismaUser } from "@prisma/client";
import type { SignupResponse } from "@yourname/helpdesk-shared";
import type { User } from "../domain/user";

export function toDomain(user: PrismaUser): User {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };
}

export function toResponseDto(user: User): SignupResponse["user"] {
  return { id: user.id, email: user.email, role: user.role };
}
