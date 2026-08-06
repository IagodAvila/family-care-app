import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { toRelativeInput } from "@/lib/family-data";
import { withApi } from "@/lib/api/respond";
import type { Relative } from "@/types/family";

async function getService() {
  const env = await getAppEnv();
  return new FamilyCareDataService(createDb(env.DB));
}

type RouteContext = { params: Promise<{ familyId: string }> };

/**
 * One-time import of whatever is in the browser's `localStorage` into the
 * signed-in user's family. Simpler than the idempotent, `import_source_id`
 * -tracked flow docs/architecture.md describes for a multi-tenant rollout:
 * `FamilyCareDataService.createRelative` doesn't accept an
 * `importSourceId` yet, and this app currently has one real user (the
 * owner), so the frontend guards against double-import by only offering
 * this action once, right after the first login, instead of enforcing
 * idempotency server-side. Revisit if/when multiple households use this
 * deployment.
 */
export async function POST(request: Request, context: RouteContext) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const { familyId } = await context.params;
    const body = (await request.json()) as { relatives?: Relative[] };
    const relatives = Array.isArray(body.relatives) ? body.relatives : [];

    const service = await getService();
    const context_ = { userId: session.userId, familyId };
    const imported = [];
    for (const relative of relatives) {
      const created = await service.createRelative(context_, toRelativeInput(relative));
      imported.push(created);
    }

    return Response.json({ imported: imported.length, relatives: imported });
  });
}
