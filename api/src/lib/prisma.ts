import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, type Prisma } from "@prisma/client";

export const prisma = new PrismaClient();

type TransactionClient = Prisma.TransactionClient;

const transactionStorage = new AsyncLocalStorage<TransactionClient>();

export function db(): PrismaClient | TransactionClient {
  return transactionStorage.getStore() ?? prisma;
}

export function runWithTransactionClient<T>(
  tx: TransactionClient,
  fn: () => Promise<T>,
): Promise<T> {
  return transactionStorage.run(tx, fn);
}
