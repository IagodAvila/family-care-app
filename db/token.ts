/**
 * Random tokens for invitation links (and, potentially, future
 * emergency-access links per docs/architecture.md). Only the hash is ever
 * persisted — the plaintext token exists solely in the response that
 * creates it and in the link the admin shares.
 *
 * Kept self-contained (no dependency on lib/auth) so db/ stays a plain
 * domain layer; lib/auth/signed-cookie.ts has an equivalent
 * `toBase64Url` for the same reason.
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 256 bits of entropy by default — well above the 128-bit floor docs/architecture.md sets. */
export function generateToken(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(digest));
}
