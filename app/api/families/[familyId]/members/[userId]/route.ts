import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import type { FamilyRole } from "@/db/schema";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

type RouteContext = { params: Promise<{ familyId: string; userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, userId } = await context.params;
    const input = (await request.json()) as { role?: FamilyRole };
    const member = await (await getService()).changeMemberRole(
      { userId: session.userId, familyId },
      userId,
      input.role ?? "viewer",
    );
    return Response.json({ member });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId, userId } = await context.params;
    const member = await (await getService()).revokeMember({ userId: session.userId, familyId }, userId);
    return Response.json({ member });
  });
}
