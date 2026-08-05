import { DomainError } from "../domain/errors";
import type { ApiResult } from "./api-result";

export function toErrorResponse(err: unknown): ApiResult {
  if (err instanceof DomainError) {
    return { statusCode: err.statusCode, body: JSON.stringify({ error: err.message }) };
  }
  throw err;
}
