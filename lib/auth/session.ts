import { buildClearCookie, buildSetCookie, parseCookie } from "./cookies.ts";
import { signValue, verifyValue } from "./signed-cookie.ts";

export const SESSION_COOKIE_NAME = "familycare_session";

/** Absolute session lifetime, per the value proposed in docs/architecture.md §5. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export type SessionPayload = { userId: string };

export async function createSessionCookieValue(userId: string, secret: string): Promise<string> {
  return signValue<SessionPayload>({ userId }, secret, SESSION_TTL_MS);
}

export async function readSessionFromRequest(
  request: Request,
  secret: string,
): Promise<SessionPayload | null> {
  return readSessionFromCookieValue(parseCookie(request.headers.get("Cookie"), SESSION_COOKIE_NAME), secret);
}

/** For server components (e.g. app/convite/[token]/page.tsx), which read cookies via `next/headers` instead of a `Request`. */
export async function readSessionFromCookieValue(
  cookieValue: string | undefined | null,
  secret: string,
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  return verifyValue<SessionPayload>(cookieValue, secret);
}

export function buildSessionSetCookie(value: string, secure: boolean): string {
  return buildSetCookie(SESSION_COOKIE_NAME, value, { maxAgeSeconds: SESSION_MAX_AGE_SECONDS, secure });
}

export function buildSessionClearCookie(secure: boolean): string {
  return buildClearCookie(SESSION_COOKIE_NAME, { secure });
}
