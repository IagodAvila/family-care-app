import { buildSessionClearCookie } from "@/lib/auth/session";
import { withApi } from "@/lib/api/respond";

export async function POST(request: Request) {
  return withApi(async () => {
    const isSecure = new URL(request.url).protocol === "https:";
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": buildSessionClearCookie(isSecure) },
    });
  });
}
