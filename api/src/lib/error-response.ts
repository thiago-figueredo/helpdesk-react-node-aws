import { DomainError } from "../domain/errors";

export interface ErrorResult {
  statusCode: number;
  body: string;
}

export function toErrorResponse(err: unknown): ErrorResult {
  if (err instanceof DomainError) {
    return { statusCode: err.statusCode, body: JSON.stringify({ error: err.message }) };
  }
  throw err;
}
