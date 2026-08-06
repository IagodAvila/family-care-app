import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const env = await getAppEnv();
    const input = (await request.json()) as { token?: string };
    const service = new FamilyCareDataService(createDb(env.DB));
    const family = await service.acceptInvitation(session, input.token ?? "");
    return Response.json({ family });
  });
}
