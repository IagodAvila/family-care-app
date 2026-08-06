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

export async function POST(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, relativeId } = await context.params;
    const input = await request.json();
    const medication = await (await getService()).createMedication(
      { userId: session.userId, familyId },
      relativeId,
      input,
    );
    return Response.json({ medication }, { status: 201 });
  });
}
