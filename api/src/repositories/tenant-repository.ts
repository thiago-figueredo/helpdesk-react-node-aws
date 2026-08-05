import type { Tenant } from "../domain/tenant";
import { getDbClient } from "../lib/prisma";
import { toDomain } from "../mappers/tenant-mapper";

export interface CreateTenantInput {
  name: string;
  slaHours?: number;
}

export const tenantRepository = {
  async create(input: CreateTenantInput): Promise<Tenant> {
    const tenant = await getDbClient().tenant.create({
      data: {
        name: input.name,
        ...(input.slaHours !== undefined ? { slaHours: input.slaHours } : {}),
      },
    });

    return toDomain(tenant);
  },
};
