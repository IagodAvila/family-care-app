"use client";

/** Thin `fetch` wrapper for the `/api/**` routes, shared by every client component that talks to them. */
export type ApiError = Error & { status?: number };

export async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    let message = `Falha na requisição (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // response body wasn't JSON; keep the generic message.
    }
    const error: ApiError = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}
