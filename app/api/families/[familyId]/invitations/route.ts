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
    const invitations = await (await getService()).listInvitations({ userId: session.userId, familyId });
    return Response.json({ invitations });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId } = await context.params;
    const input = (await request.json()) as { emailNormalized?: string; role?: "caregiver" | "viewer" };
    // `createInvitation` returns the plaintext token only this once — the
    // caller (see app/components/invite-dialog.tsx) turns it into a
    // shareable link right away; nothing after this response can recover it.
    const { invitation, token } = await (await getService()).createInvitation(
      { userId: session.userId, familyId },
      { emailNormalized: input.emailNormalized ?? "", role: input.role ?? "viewer" },
    );
    return Response.json({ invitation, token }, { status: 201 });
  });
}
