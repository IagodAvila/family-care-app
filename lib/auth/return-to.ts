/**
 * Sanitizes a client-supplied `?return_to=` into a same-origin relative
 * path, or `"/"` if it's anything else — same shape as the existing
 * `safeRelativeReturnPath` in app/chatgpt-auth.ts, kept separate since
 * that file is a different (currently unused) auth integration.
 */
const RESERVED_PATHS = ["/api/auth/login", "/api/auth/callback", "/api/auth/logout"];

export function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (RESERVED_PATHS.includes(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}
