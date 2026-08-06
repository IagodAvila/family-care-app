/** Small `Cookie`/`Set-Cookie` helpers — no dependency needed for this. */

export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separatorIndex + 1).trim());
  }

  return null;
}

export type SetCookieOptions = {
  maxAgeSeconds: number;
  /** Pass `new URL(request.url).protocol === "https:"` — plain-HTTP local dev can't set a `Secure` cookie. */
  secure: boolean;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
};

export function buildSetCookie(name: string, value: string, options: SetCookieOptions): string {
  const { maxAgeSeconds, secure, path = "/", sameSite = "Lax" } = options;
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    `SameSite=${sameSite}`,
  ];
  if (secure) segments.push("Secure");
  return segments.join("; ");
}

export function buildClearCookie(name: string, options: { secure: boolean; path?: string }): string {
  return buildSetCookie(name, "", { ...options, maxAgeSeconds: 0 });
}
