import { and, eq } from "drizzle-orm";
import { createDb } from "@/db";
import { users } from "@/db/schema";
import { buildClearCookie, parseCookie } from "@/lib/auth/cookies";
import { getAppEnv } from "@/lib/auth/env";
import { exchangeGoogleCode, fetchGoogleProfile } from "@/lib/auth/google";
import { OAUTH_HANDSHAKE_COOKIE_NAME } from "@/lib/auth/oauth-handshake";
import { buildSessionSetCookie, createSessionCookieValue } from "@/lib/auth/session";
import { verifyValue } from "@/lib/auth/signed-cookie";
import { withApi } from "@/lib/api/respond";

export async function GET(request: Request) {
  return withApi(async () => {
    const env = await getAppEnv();
    const url = new URL(request.url);
    const isSecure = url.protocol === "https:";

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const handshakeCookie = parseCookie(request.headers.get("Cookie"), OAUTH_HANDSHAKE_COOKIE_NAME);

    if (!code || !state || !handshakeCookie) {
      return new Response("Requisição de login inválida ou expirada. Tente entrar novamente.", {
        status: 400,
      });
    }

    const handshake = await verifyValue<{ state: string; verifier: string }>(
      handshakeCookie,
      env.SESSION_SECRET,
    );
    if (!handshake || handshake.state !== state) {
      return new Response("Estado de login inválido ou expirado. Tente entrar novamente.", {
        status: 400,
      });
    }

    const redirectUri = `${url.origin}/api/auth/callback`;
    const { accessToken } = await exchangeGoogleCode({
      code,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri,
      codeVerifier: handshake.verifier,
    });
    const profile = await fetchGoogleProfile(accessToken);

    const db = createDb(env.DB);
    const now = Date.now();
    const [existing] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(and(eq(users.authProvider, "google"), eq(users.authSubject, profile.sub)));

    let userId: string;
    if (existing) {
      userId = existing.id;
      await db
        .update(users)
        .set({
          displayName: profile.name ?? existing.displayName,
          emailNormalized: profile.email.toLowerCase(),
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    } else {
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        authProvider: "google",
        authSubject: profile.sub,
        emailNormalized: profile.email.toLowerCase(),
        displayName: profile.name,
        status: "active",
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const sessionCookieValue = await createSessionCookieValue(userId, env.SESSION_SECRET);

    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", buildSessionSetCookie(sessionCookieValue, isSecure));
    headers.append("Set-Cookie", buildClearCookie(OAUTH_HANDSHAKE_COOKIE_NAME, { secure: isSecure }));

    return new Response(null, { status: 302, headers });
  });
}
