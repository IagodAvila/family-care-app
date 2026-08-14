"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js` on every page load. Renders nothing.
 *
 * The push toggle (push-notifications-toggle.tsx) also registers it, but
 * only when someone actually turns notifications on — the worker has to be
 * active for *everyone* for the browser to consider the app installable
 * and for the offline fallback to exist, so it can't wait on that opt-in.
 * Registering twice with the same URL is a no-op, so the two coexist.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Deliberately unhandled beyond logging: a failed registration costs
    // installability and offline support, but the app itself works fine
    // without it, so it must never surface as an error to the user.
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Falha ao registrar o service worker:", error);
    });
  }, []);

  return null;
}
