import type { Tenant } from "../domain/tenant";
import { db } from "../lib/prisma";
import { toDomain } from "../mappers/tenant-mapper";

export interface CreateTenantInput {
  name: string;
  slaHours?: number;
}

export const tenantRepository = {
  async create(input: CreateTenantInput): Promise<Tenant> {
    const tenant = await db().tenant.create({
      data: {
        name: input.name,
        ...(input.slaHours !== undefined ? { slaHours: input.slaHours } : {}),
      },
    });

    return toDomain(tenant);
  },

  async findById(id: string): Promise<Tenant | null> {
    const tenant = await db().tenant.findUnique({ where: { id } });
    return tenant ? toDomain(tenant) : null;
  },
};
