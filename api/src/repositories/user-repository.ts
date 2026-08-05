import { Prisma } from "@prisma/client";
import { DuplicateEmailError } from "../domain/errors";
import type { User } from "../domain/user";
import { getDbClient } from "../lib/prisma";
import { toDomain } from "../mappers/user-mapper";

export interface CreateUserInput {
  tenantId: string;
  email: string;
  passwordHash: string;
  role: "admin" | "agent";
}

export const userRepository = {
  async create(input: CreateUserInput): Promise<User> {
    try {
      const user = await getDbClient().user.create({ data: input });
      return toDomain(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new DuplicateEmailError();
      }
      throw err;
    }
  },
};
