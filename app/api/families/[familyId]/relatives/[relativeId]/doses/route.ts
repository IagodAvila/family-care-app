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
  params: Promise<{ familyId: string; relativeId: string }>;
};

/** Today's schedule occurrences for a relative, each paired with its dose if already logged. */
export async function GET(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, relativeId } = await context.params;
    const doses = await (await getService()).listTodayDoses(
      { userId: session.userId, familyId },
      relativeId,
    );
    return Response.json({ doses });
  });
}
