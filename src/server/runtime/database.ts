import { IS_BUN } from "./detect";
import { createRequire } from "module";

export interface StatementLike {
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface DatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): StatementLike;
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
  close(): void;
}

export function openDatabaseSync(path: string): DatabaseLike {
  if (IS_BUN) {
    const require = createRequire(import.meta.url);
    const { Database } = require("bun:sqlite");
    return new Database(path) as DatabaseLike;
  } else {
    const require = createRequire(import.meta.url);
    const Database = require("better-sqlite3");
    return new Database(path) as DatabaseLike;
  }
}
