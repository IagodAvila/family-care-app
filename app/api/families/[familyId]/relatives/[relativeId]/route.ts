import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

type RouteContext = { params: Promise<{ familyId: string; relativeId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, relativeId } = await context.params;
    const relative = await (await getService()).getRelative({ userId: session.userId, familyId }, relativeId);
    return Response.json({ relative });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, relativeId } = await context.params;
    const input = await request.json();
    const relative = await (await getService()).updateRelative(
      { userId: session.userId, familyId },
      relativeId,
      input,
    );
    return Response.json({ relative });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, relativeId } = await context.params;
    const expectedVersion = Number(new URL(request.url).searchParams.get("expectedVersion"));
    await (await getService()).deleteRelative({ userId: session.userId, familyId }, relativeId, expectedVersion);
    return new Response(null, { status: 204 });
  });
}
