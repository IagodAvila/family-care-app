import { getAppEnv } from "./env.ts";
import { readSessionFromRequest, type SessionPayload } from "./session.ts";

export class UnauthorizedError extends Error {
  constructor(message = "Sessão ausente ou expirada.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Reads and verifies the session cookie; throws `UnauthorizedError` if absent/expired. */
export async function requireSessionUser(request: Request): Promise<SessionPayload> {
  const env = await getAppEnv();
  const session = await readSessionFromRequest(request, env.SESSION_SECRET);
  if (!session) throw new UnauthorizedError();
  return session;
}
