import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

type RouteContext = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId } = await context.params;
    const relatives = await (await getService()).listRelatives({ userId: session.userId, familyId });
    return Response.json({ relatives });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId } = await context.params;
    const input = await request.json();
    const relative = await (await getService()).createRelative({ userId: session.userId, familyId }, input);
    return Response.json({ relative }, { status: 201 });
  });
}
