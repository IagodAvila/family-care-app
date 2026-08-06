import type { AnyD1Database } from "drizzle-orm/d1";

/**
 * Bindings and secrets the app needs at request time. `worker/index.ts`
 * declares the same `DB`/`ASSETS`/`IMAGES` bindings for the top-level fetch
 * handler; this is the equivalent surface for code running inside App
 * Router route handlers, which vinext does not thread `env` into (see
 * docs/architecture.md and the D1 wiring plan for why `cloudflare:workers`
 * is used here instead of a function parameter).
 */
export type AppEnv = {
  DB: AnyD1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};

const REQUIRED_KEYS: (keyof AppEnv)[] = [
  "DB",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SESSION_SECRET",
];

/**
 * Reads the current request's bindings/secrets. Throws a descriptive error
 * if something required is missing, instead of failing later with a
 * confusing "undefined is not a function" deep inside a route handler.
 *
 * Imports `cloudflare:workers` dynamically (only when a route actually
 * calls this), not at module top level: vinext bundles every route into
 * one server entry, and `tests/rendered-html.test.mjs` loads that entry
 * directly under plain Node (outside workerd) to render `/` — a top-level
 * import would make that fail to resolve the module before any API route
 * even runs.
 */
export async function getAppEnv(): Promise<AppEnv> {
  const { env } = await import("cloudflare:workers");
  const missing = REQUIRED_KEYS.filter((key) => env[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Bindings/segredos ausentes no Worker: ${missing.join(", ")}. ` +
        "Configure-os com `wrangler secret put` (produção) ou `.dev.vars` (desenvolvimento).",
    );
  }

  return env as unknown as AppEnv;
}
