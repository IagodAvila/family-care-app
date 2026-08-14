import { getAppEnv } from "@/lib/auth/env";
import { withApi } from "@/lib/api/respond";

/**
 * The VAPID public key isn't a secret (browsers hand it to the push
 * service on every subscribe call), so this is intentionally unauthenticated.
 * Returns 501 if the feature hasn't been configured — see lib/auth/env.ts.
 */
export async function GET() {
  return withApi(async () => {
    const env = await getAppEnv();
    if (!env.VAPID_PUBLIC_KEY) {
      return Response.json(
        { error: "Notificações push não estão configuradas neste ambiente." },
        { status: 501 },
      );
    }
    return Response.json({ publicKey: env.VAPID_PUBLIC_KEY });
  });
}
