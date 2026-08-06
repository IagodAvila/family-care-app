import { toBase64Url } from "./signed-cookie.ts";

/**
 * Minimal Google OAuth 2.0 (Authorization Code + PKCE) implementation using
 * only `fetch`/Web Crypto. Not using a third-party OAuth client library on
 * purpose: `arctic`, the obvious pick for an edge-compatible client, was
 * marked "no longer supported" on npm right before this was written — not
 * worth the supply-chain risk for an auth flow this small.
 */

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export function generateState(): string {
  return crypto.randomUUID();
}

/** PKCE code_verifier/code_challenge pair (RFC 7636, S256 method). */
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: toBase64Url(new Uint8Array(digest)) };
}

export function buildGoogleAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ accessToken: string }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      code_verifier: options.codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao trocar o código de login com o Google (status ${response.status}).`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Resposta do Google sem access_token.");
  return { accessToken: data.access_token };
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar o perfil do Google (status ${response.status}).`);
  }

  const data = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!data.sub || !data.email) throw new Error("Perfil do Google incompleto.");

  return {
    sub: data.sub,
    email: data.email,
    emailVerified: Boolean(data.email_verified),
    name: data.name ?? null,
  };
}
