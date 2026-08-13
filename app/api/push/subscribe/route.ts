import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const input = await request.json();
    await (await getService()).upsertPushSubscription(
      { userId: session.userId },
      input,
    );
    return new Response(null, { status: 204 });
  });
}

export async function DELETE(request: Request) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { endpoint } = await request.json();
    await (await getService()).deletePushSubscription(
      { userId: session.userId },
      endpoint,
    );
    return new Response(null, { status: 204 });
  });
}
