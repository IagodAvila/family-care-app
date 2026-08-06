/**
 * Cloudflare Workers ships a built-in `cloudflare:workers` runtime module
 * that exposes the current Worker's bindings as a live `env` export,
 * without needing them threaded through function parameters. There is no
 * `@cloudflare/workers-types` package installed in this project (see
 * `worker/index.ts` for the same hand-rolled `Env` typing pattern), so this
 * ambient declaration exists purely to satisfy the type checker — the
 * runtime resolves the real module via `@cloudflare/vite-plugin`/Wrangler.
 */
declare module "cloudflare:workers" {
  const env: Record<string, unknown>;
  export { env };
}
