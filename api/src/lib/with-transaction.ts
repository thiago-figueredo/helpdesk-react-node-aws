import { toErrorResponse, type ErrorResult } from "./error-response";
import { prisma, runWithTransactionClient } from "./prisma";

export function withTransaction<Event, Res>(
  fn: (event: Event) => Promise<Res>,
): (event: Event) => Promise<Res | ErrorResult> {
  return async (event) => {
    try {
      return await prisma.$transaction((tx) => runWithTransactionClient(tx, () => fn(event)));
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
