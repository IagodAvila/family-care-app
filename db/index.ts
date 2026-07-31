import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

export function createDb(binding: AnyD1Database) {
  return drizzle(binding, { schema });
}

export type FamilyCareDatabase = ReturnType<typeof createDb>;

export function getDb(binding?: AnyD1Database) {
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return createDb(binding);
}
