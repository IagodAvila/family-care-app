"use client";

import { useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api-client";

type Status =
  | "checking"
  | "unsupported"
  | "unavailable"
  | "denied"
  | "enabled"
  | "disabled";

const SERVICE_WORKER_URL = "/sw.js";

/** A VAPID public key (URL-safe base64) → the `Uint8Array` `subscribe()` needs. */
function applicationServerKey(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Account-level toggle for medication-reminder push notifications — one
 * subscription per user+device covers every relative's reminders, so this
 * lives once in the account menu rather than being duplicated per relative.
 * Never prompts on mount: `Notification.requestPermission()` only ever
 * runs from the click handler below, per browser best practice.
 */
export function PushNotificationsToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (
        typeof window === "undefined"
        || !("serviceWorker" in navigator)
        || !("PushManager" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelled) setStatus(subscription ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setStatus("disabled");
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
      await navigator.serviceWorker.ready;

      const { publicKey } = await api("/api/push/public-key");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS's DOM lib types `PushManager.subscribe`'s key as the stricter
        // `ArrayBuffer`-backed `BufferSource`; `Uint8Array` is generic over
        // `ArrayBufferLike` since TS 5.7, so a plain `Uint8Array` no longer
        // satisfies it structurally even though it's valid at runtime.
        applicationServerKey: applicationServerKey(publicKey) as BufferSource,
      });
      const json = subscription.toJSON();

      await api("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          authKey: json.keys?.auth,
          userAgent: navigator.userAgent,
        }),
      });
      setStatus("enabled");
    } catch (error) {
      setStatus((error as ApiError)?.status === 501 ? "unavailable" : "disabled");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("disabled");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking" || status === "unsupported" || status === "unavailable") {
    return null;
  }

  if (status === "denied") {
    return (
      <p className="user-menu-item user-menu-note" role="note">
        Notificações bloqueadas nas configurações do navegador.
      </p>
    );
  }

  return (
    <button
      className="user-menu-item user-menu-item--toggle"
      type="button"
      role="menuitemcheckbox"
      aria-checked={status === "enabled"}
      disabled={busy}
      onClick={status === "enabled" ? disable : enable}
    >
      {status === "enabled" ? "Desativar lembretes de remédio" : "Ativar lembretes de remédio"}
    </button>
  );
}
