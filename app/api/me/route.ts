import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { FamilyCareDataService } from "@/db/services/family-care";
import { users } from "@/db/schema";
import { getAppEnv } from "@/lib/auth/env";
import { requireSessionUser } from "@/lib/auth/require-user";
import { withApi } from "@/lib/api/respond";

/** Current logged-in user plus the families they belong to — used on app boot. */
export async function GET(request: Request) {
  return withApi(async () => {
    const session = await requireSessionUser(request);
    const env = await getAppEnv();
    const db = createDb(env.DB);

    const [user] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        emailNormalized: users.emailNormalized,
      })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 401 });
    }

    const service = new FamilyCareDataService(db);
    const families = await service.listFamilies({ userId: session.userId });

    return Response.json({ user, families });
  });
}
