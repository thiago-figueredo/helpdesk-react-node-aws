import type { Tenant } from "../domain/tenant";
import { db } from "../lib/prisma";
import { toDomain } from "../mappers/tenant-mapper";

export const tenantRepository = {
  async findById(id: string): Promise<Tenant | null> {
    const tenant = await db().tenant.findUnique({ where: { id } });
    return tenant ? toDomain(tenant) : null;
  },

  async getOrCreate(name: string, slaHours?: number): Promise<Tenant> {
    const tenant = await db().tenant.upsert({
      where: { name },
      update: {},
      create: {
        name,
        ...(slaHours !== undefined ? { slaHours } : {}),
      },
    });
    return toDomain(tenant);
  },
};
