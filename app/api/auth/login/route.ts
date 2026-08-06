import { buildSetCookie } from "@/lib/auth/cookies";
import { getAppEnv } from "@/lib/auth/env";
import { buildGoogleAuthUrl, generatePkcePair, generateState } from "@/lib/auth/google";
import { OAUTH_HANDSHAKE_COOKIE_NAME, OAUTH_HANDSHAKE_TTL_MS } from "@/lib/auth/oauth-handshake";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { signValue } from "@/lib/auth/signed-cookie";
import { withApi } from "@/lib/api/respond";

export async function GET(request: Request) {
  return withApi(async () => {
    const env = await getAppEnv();
    const url = new URL(request.url);
    const isSecure = url.protocol === "https:";
    const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));

    const state = generateState();
    const { verifier, challenge } = await generatePkcePair();
    const redirectUri = `${url.origin}/api/auth/callback`;

    const authorizeUrl = buildGoogleAuthUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri,
      state,
      codeChallenge: challenge,
    });

    const handshakeCookieValue = await signValue(
      { state, verifier, returnTo },
      env.SESSION_SECRET,
      OAUTH_HANDSHAKE_TTL_MS,
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizeUrl,
        "Set-Cookie": buildSetCookie(OAUTH_HANDSHAKE_COOKIE_NAME, handshakeCookieValue, {
          maxAgeSeconds: OAUTH_HANDSHAKE_TTL_MS / 1000,
          secure: isSecure,
        }),
      },
    });
  });
}
