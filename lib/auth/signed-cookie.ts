/**
 * Generic signed, self-expiring token used for both the session cookie
 * (lib/auth/session.ts) and the short-lived OAuth handshake cookie
 * (lib/auth/google.ts). Stateless by design — no `sessions` table, per the
 * tradeoff recorded in docs/architecture.md (the server always issues and
 * verifies its own token; membership revocation still happens server-side
 * via `family_members`, independent of this token being valid).
 *
 * Only Web Crypto (`crypto.subtle`) is used — no extra dependency, works
 * identically in `wrangler dev` and production Workers.
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

type Envelope<T> = { payload: T; expiresAt: number };

/** Signs `payload`, embedding an absolute expiry `ttlMs` from now. */
export async function signValue<T>(payload: T, secret: string, ttlMs: number): Promise<string> {
  const envelope: Envelope<T> = { payload, expiresAt: Date.now() + ttlMs };
  const envelopeB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(envelope)));
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(envelopeB64));
  return `${envelopeB64}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Verifies signature and expiry; returns the original payload or `null` if invalid/expired. */
export async function verifyValue<T>(token: string, secret: string): Promise<T | null> {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  const envelopeB64 = token.slice(0, dotIndex);
  const signatureB64 = token.slice(dotIndex + 1);

  const key = await getHmacKey(secret);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signatureB64),
    new TextEncoder().encode(envelopeB64),
  );
  if (!isValid) return null;

  let envelope: Envelope<T>;
  try {
    envelope = JSON.parse(new TextDecoder().decode(fromBase64Url(envelopeB64)));
  } catch {
    return null;
  }

  if (typeof envelope.expiresAt !== "number" || envelope.expiresAt < Date.now()) return null;
  return envelope.payload;
}

export { toBase64Url };
