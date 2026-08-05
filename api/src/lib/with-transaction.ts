import type { ApiResult } from "./api-result";
import { toErrorResponse } from "./error-response";
import { prisma, runWithTransactionClient } from "./prisma";

export function withTransaction<Event, Res>(
  fn: (event: Event) => Promise<Res>,
): (event: Event) => Promise<Res | ApiResult> {
  return async (event) => {
    try {
      return await prisma.$transaction((tx) => runWithTransactionClient(tx, () => fn(event)));
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
