import type { Tenant as PrismaTenant } from "@prisma/client";
import type { TenantDto } from "@yourname/helpdesk-shared";
import type { Tenant } from "../domain/tenant";

export function toDomain(tenant: PrismaTenant): Tenant {
  return { id: tenant.id, name: tenant.name, slaHours: tenant.slaHours };
}

export function toResponseDto(tenant: Tenant): TenantDto {
  return { id: tenant.id, name: tenant.name };
}
