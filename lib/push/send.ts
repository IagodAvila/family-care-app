import { buildPushPayload, type VapidKeys } from "@block65/webcrypto-web-push";

/**
 * The `web-push` npm package relies on Node's `crypto`/`http` modules and
 * doesn't run in the Workers runtime. `@block65/webcrypto-web-push`
 * implements RFC 8291 (`aes128gcm` payload encryption) and RFC 8292 (VAPID)
 * with only Web Crypto + `fetch`, so it works in `worker/index.ts`'s
 * `scheduled` handler. This module is a thin adapter over it — the rest of
 * the app only needs `sendWebPush`.
 */
export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  authKey: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; expired: boolean; status?: number };

export async function sendWebPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
  vapid: VapidKeys,
): Promise<SendResult> {
  const request = await buildPushPayload(
    { data: payload, options: { ttl: 60 * 60, urgency: "high" } },
    {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { auth: subscription.authKey, p256dh: subscription.p256dh },
    },
    vapid,
  );

  // Same `Uint8Array<ArrayBufferLike>` vs. `BodyInit` strictness gap as in
  // push-notifications-toggle.tsx — `request.body` is valid at runtime.
  const response = await fetch(subscription.endpoint, request as RequestInit);

  if (response.ok) {
    return { ok: true };
  }
  // The push service reports a dead subscription with 404 (gone) or 410
  // (unsubscribed) — the caller should delete the stored subscription.
  const expired = response.status === 404 || response.status === 410;
  return { ok: false, expired, status: response.status };
}
