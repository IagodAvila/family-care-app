import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDb } from "@/db";
import { FamilyCareDataError } from "@/db/errors";
import { FamilyCareDataService } from "@/db/services/family-care";
import { getAppEnv } from "@/lib/auth/env";
import { readSessionFromCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Landing page for an invitation link (`/convite/<token>`, shared manually
 * by an admin — see app/components/invite-dialog.tsx). No UI of its own:
 * it resolves the token server-side and redirects, so a signed-out visitor
 * always ends up logging in as the *invited* identity check happens in
 * `FamilyCareDataService.acceptInvitation`, not here.
 */
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const env = await getAppEnv();
  const cookieStore = await cookies();
  const session = await readSessionFromCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    env.SESSION_SECRET,
  );

  if (!session) {
    redirect(`/api/auth/login?return_to=${encodeURIComponent(`/convite/${token}`)}`);
  }

  const service = new FamilyCareDataService(createDb(env.DB));
  let errorMessage: string | null = null;
  try {
    await service.acceptInvitation(session, token);
  } catch (error) {
    errorMessage = error instanceof FamilyCareDataError
      ? error.message
      : "Não foi possível aceitar o convite.";
  }

  // `redirect()` throws internally to interrupt rendering — it must never
  // be called from inside the try/catch above, or its own control-flow
  // exception would be swallowed as an "unexpected" error.
  redirect(errorMessage ? `/?inviteError=${encodeURIComponent(errorMessage)}` : "/?invited=1");
}
