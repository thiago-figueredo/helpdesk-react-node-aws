import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const BCRYPT_COST_FACTOR = 10;
const TOKEN_EXPIRY = "24h";

export interface TokenClaims {
  userId: string;
  tenantId: string;
  role: "admin" | "agent";
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

export function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(claims: TokenClaims): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(claims, secret, { expiresIn: TOKEN_EXPIRY, algorithm: "HS256" });
}
