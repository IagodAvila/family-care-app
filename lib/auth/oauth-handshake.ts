/**
 * Short-lived cookie tying a Google login attempt's `state`/PKCE
 * `code_verifier` to the browser that started it. Kept out of the route
 * files: Next.js App Router route handlers may only export recognized HTTP
 * method functions, not arbitrary constants.
 */
export const OAUTH_HANDSHAKE_COOKIE_NAME = "familycare_oauth";
export const OAUTH_HANDSHAKE_TTL_MS = 10 * 60 * 1000;
