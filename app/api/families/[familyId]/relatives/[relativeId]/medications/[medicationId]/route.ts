import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

type RouteContext = { params: Promise<{ familyId: string; medicationId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, medicationId } = await context.params;
    const input = await request.json();
    const medication = await (await getService()).updateMedication(
      { userId: session.userId, familyId },
      medicationId,
      input,
    );
    return Response.json({ medication });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, medicationId } = await context.params;
    const expectedVersion = Number(new URL(request.url).searchParams.get("expectedVersion"));
    await (await getService()).deleteMedication({ userId: session.userId, familyId }, medicationId, expectedVersion);
    return new Response(null, { status: 204 });
  });
}
