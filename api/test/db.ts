import "./env";
import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function truncateAll(): Promise<void> {
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Notification", "Message", "Ticket", "User", "Tenant" RESTART IDENTITY CASCADE;`,
  );
}

export async function setUp(): Promise<void> {
  await truncateAll();
}

export async function setDown(): Promise<void> {
  await truncateAll();
  await testPrisma.$disconnect();
}
