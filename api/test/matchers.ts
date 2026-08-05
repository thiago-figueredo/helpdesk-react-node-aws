/// <reference types="jest" />
import type { Prisma } from "@prisma/client";
import { testPrisma } from "./db";

type DatabaseTable = Uncapitalize<Prisma.ModelName>;
type Criteria = Record<string, unknown>;
type Delegate = { findMany: (args?: unknown) => Promise<unknown[]> };

declare global {
  namespace jest {
    interface Matchers<R, T = {}> {
      assertDatabaseHas(criteria: Criteria): Promise<R>;
      assertDatabaseHasOne(criteria: Criteria): Promise<R>;
      assertDatabaseCount(count: number): Promise<R>;
      assertDatabaseCount(criteria: Criteria, count: number): Promise<R>;
      assertNotInDatabase(criteria: Criteria): Promise<R>;
    }
  }
}

function delegateFor(table: DatabaseTable): Delegate {
  return (testPrisma as unknown as Record<DatabaseTable, Delegate>)[table];
}

function findMany(table: DatabaseTable, where?: Criteria): Promise<unknown[]> {
  return delegateFor(table).findMany(where ? { where } : undefined);
}

async function diagnostics(
  table: DatabaseTable,
  criteria: Criteria,
): Promise<string> {
  const sample = await delegateFor(table).findMany({ take: 5 });
  return [
    `Table: ${table}`,
    `Criteria: ${JSON.stringify(criteria)}`,
    `Sample of actual rows in "${table}":`,
    JSON.stringify(sample, null, 2),
  ].join("\n");
}

expect.extend({
  async assertDatabaseHas(table: DatabaseTable, criteria: Criteria) {
    const matches = await findMany(table, criteria);
    const pass = matches.length >= 1;
    const message = pass
      ? `Expected no rows in "${table}" to match ${JSON.stringify(criteria)}, but found ${matches.length}.`
      : `Expected at least one row in "${table}" to match ${JSON.stringify(criteria)}, but found none.\n${await diagnostics(table, criteria)}`;

    return { pass, message: () => message };
  },

  async assertDatabaseHasOne(table: DatabaseTable, criteria: Criteria) {
    const matches = await findMany(table, criteria);
    const pass = matches.length === 1;
    const message = pass
      ? `Expected more than one row in "${table}" to match ${JSON.stringify(criteria)}, but found exactly one.`
      : `Expected exactly one row in "${table}" to match ${JSON.stringify(criteria)}, but found ${matches.length}.\n${await diagnostics(table, criteria)}`;

    return { pass, message: () => message };
  },

  async assertDatabaseCount(
    table: DatabaseTable,
    criteriaOrCount: Criteria | number,
    maybeCount?: number,
  ) {
    const hasCriteria = typeof criteriaOrCount !== "number";
    const criteria = hasCriteria ? (criteriaOrCount as Criteria) : undefined;
    const expectedCount = hasCriteria
      ? (maybeCount as number)
      : (criteriaOrCount as number);

    const matches = await findMany(table, criteria);
    const pass = matches.length === expectedCount;
    const scope = criteria ? ` matching ${JSON.stringify(criteria)}` : "";
    const message = pass
      ? `Expected "${table}" to have a count other than ${expectedCount}${scope}, but it matched.`
      : `Expected "${table}" to have ${expectedCount} row(s)${scope}, but found ${matches.length}.\n${await diagnostics(table, criteria ?? {})}`;

    return { pass, message: () => message };
  },

  async assertNotInDatabase(table: DatabaseTable, criteria: Criteria) {
    const matches = await findMany(table, criteria);
    const pass = matches.length === 0;
    const message = pass
      ? `Expected at least one row in "${table}" to match ${JSON.stringify(criteria)}, but found none.`
      : `Expected no rows in "${table}" to match ${JSON.stringify(criteria)}, but found ${matches.length}.\n${await diagnostics(table, criteria)}`;

    return { pass, message: () => message };
  },
});
