import { FamilyCareDataError } from "@/db/errors";
import { UnauthorizedError } from "@/lib/auth/require-user";

const STATUS_BY_ERROR_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  LAST_ADMIN: 409,
  STORAGE_FAILURE: 500,
};

/**
 * Maps a thrown error to an HTTP `Response`. `FamilyCareDataError.message`
 * is already sanitized for end-user display (see db/errors.ts), so it's
 * safe to return as-is; anything else is logged server-side and replaced
 * with a generic message so no unexpected internals/PHI leak to the client.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FamilyCareDataError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: STATUS_BY_ERROR_CODE[error.code] ?? 400 },
    );
  }

  console.error(error);
  return Response.json({ error: "Erro inesperado no servidor." }, { status: 500 });
}

/** Wraps a route handler body so every thrown error becomes a mapped `Response`. */
export async function withApi(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}
