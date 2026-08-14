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
  params: Promise<{ familyId: string; medicationId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, medicationId } = await context.params;
    const schedules = await (await getService()).listSchedules(
      { userId: session.userId, familyId },
      medicationId,
    );
    return Response.json({ schedules });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, medicationId } = await context.params;
    const input = await request.json();
    const schedule = await (await getService()).createSchedule(
      { userId: session.userId, familyId },
      medicationId,
      input,
    );
    return Response.json({ schedule }, { status: 201 });
  });
}
