import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

const MIGRATION_BREAKPOINT = "--> statement-breakpoint";

class LocalD1PreparedStatement {
  constructor(database, query, parameters = []) {
    this.database = database;
    this.query = query;
    this.parameters = parameters;
  }

  bind(...parameters) {
    return new LocalD1PreparedStatement(this.database, this.query, parameters);
  }

  async run() {
    return this.execute();
  }

  async all() {
    const statement = this.database.prepare(this.query);
    const results = statement.all(...this.parameters);
    return {
      success: true,
      results,
      meta: { changes: 0, duration: 0 },
    };
  }

  /**
   * drizzle-orm's D1 session calls `.raw()` (not `.all()`) whenever a query
   * has an explicit `fields` selection — e.g. any multi-table join with
   * `.select({...})` — and maps the result back to those fields *by column
   * position*, not by name (see `mapResultRow` in drizzle-orm's d1/session).
   *
   * `node:sqlite`'s `StatementSync` has no positional/array output mode in
   * the Node version this project targets (`.nvmrc`) — `setReturnArrays`
   * only exists in newer Node builds, so relying on it here breaks CI
   * (pinned via `.nvmrc`) even though it works locally on a newer Node.
   * `Object.values(row)` on `.all()`'s plain-object rows is positionally
   * correct too, *as long as every selected column has a unique name* —
   * callers that join same-named columns from different tables (e.g.
   * `medications.id` and `relatives.id`) must alias them explicitly with
   * `sql\`${col}\`.as("alias")` (plain `.select({ key: col })` does NOT
   * emit a SQL-level alias — see db/queries/reminders.ts for the pattern).
   * Without a real SQL alias, `.all()`'s row object would silently
   * collapse the duplicate key, and `Object.values()` would just be
   * positionally wrong instead of erroring — there's no way to detect
   * that case here, so it's on the caller to alias everything.
   */
  async raw() {
    const { results } = await this.all();
    return results.map((row) => Object.values(row));
  }

  async first(column) {
    const { results } = await this.all();
    const row = results[0] ?? null;
    return column && row ? row[column] ?? null : row;
  }

  execute() {
    const statement = this.database.prepare(this.query);
    const result = statement.run(...this.parameters);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes),
        duration: 0,
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

export class LocalD1Database {
  constructor() {
    this.database = new DatabaseSync(":memory:");
    this.database.exec("PRAGMA foreign_keys = ON");
  }

  prepare(query) {
    return new LocalD1PreparedStatement(this.database, query);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(query) {
    this.database.exec(query);
    return { count: 1, duration: 0 };
  }

  close() {
    this.database.close();
  }
}

export async function applyMigrations(database) {
  const migrationDirectory = new URL("../../drizzle/", import.meta.url);
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const source = await readFile(
      new URL(migrationFile, migrationDirectory),
      "utf8",
    );
    for (const statement of source.split(MIGRATION_BREAKPOINT)) {
      const sql = statement.trim();
      if (sql) {
        await database.exec(sql);
      }
    }
  }
}
