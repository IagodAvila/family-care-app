import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

export async function GET(request: Request) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const families = await (await getService()).listFamilies({ userId: session.userId });
    return Response.json({ families });
  });
}

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const body = (await request.json()) as { name?: string };
    const family = await (await getService()).createFamily({ userId: session.userId }, { name: body.name ?? "" });
    return Response.json({ family }, { status: 201 });
  });
}
