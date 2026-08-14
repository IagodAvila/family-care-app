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

/** Marks a dose occurrence as taken (`{ occurrenceDate, takenAt?, notes? }`). */
export async function POST(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, scheduleId } = await context.params;
    const input = await request.json();
    const dose = await (await getService()).logDoseTaken(
      { userId: session.userId, familyId },
      scheduleId,
      input,
    );
    return Response.json({ dose }, { status: 201 });
  });
}

/** Reverts a dose mistakenly marked as taken (`?occurrenceDate=YYYY-MM-DD`). */
export async function DELETE(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, scheduleId } = await context.params;
    const occurrenceDate = new URL(request.url).searchParams.get("occurrenceDate") ?? "";
    const dose = await (await getService()).undoDoseTaken(
      { userId: session.userId, familyId },
      scheduleId,
      occurrenceDate,
    );
    return Response.json({ dose });
  });
}
