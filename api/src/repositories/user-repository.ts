import { Prisma, type Role } from "@prisma/client";
import { DuplicateEmailError } from "../domain/errors";
import type { User } from "../domain/user";
import { db } from "../lib/prisma";
import { toDomain } from "../mappers/user-mapper";

export interface CreateUserInput {
  tenantId: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export const userRepository = {
  async create(input: CreateUserInput): Promise<User> {
    try {
      const user = await db().user.create({ data: input });
      return toDomain(user);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new DuplicateEmailError();
      }
      throw err;
    }
  },

  async findByEmail(email: string): Promise<User | null> {
    const user = await db().user.findUnique({ where: { email } });
    return user ? toDomain(user) : null;
  },
};
