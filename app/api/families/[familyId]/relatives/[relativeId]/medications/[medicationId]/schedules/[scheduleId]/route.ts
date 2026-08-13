import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

type RouteContext = {
  params: Promise<{ familyId: string; scheduleId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, scheduleId } = await context.params;
    const input = await request.json();
    const schedule = await (await getService()).updateSchedule(
      { userId: session.userId, familyId },
      scheduleId,
      input,
    );
    return Response.json({ schedule });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, scheduleId } = await context.params;
    const expectedVersion = Number(new URL(request.url).searchParams.get("expectedVersion"));
    await (await getService()).deleteSchedule(
      { userId: session.userId, familyId },
      scheduleId,
      expectedVersion,
    );
    return new Response(null, { status: 204 });
  });
}
