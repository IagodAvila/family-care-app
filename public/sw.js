/**
 * Service worker: medication-reminder push notifications, plus the caching
 * that makes the app installable as a PWA. See
 * app/components/push-notifications-toggle.tsx for how it's registered and
 * public/manifest.webmanifest for the install metadata.
 *
 * Caching is deliberately narrow. This app holds family medical records
 * behind a login, so **nothing from `/api/**` is ever cached** — those
 * responses carry health data and are tied to a session that can be
 * revoked. Only the build's own static assets (hashed filenames, so a new
 * deploy can never be served a stale one) and a bare offline fallback for
 * navigations are stored.
 */

// Bump to evict everything from previous deploys (see `activate`).
const CACHE_VERSION = "familycare-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  // Take over as soon as the new worker is ready rather than waiting for
  // every tab to close — an updated app shell shouldn't sit behind a tab
  // the user left open for days.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/** Hashed build output — safe to serve from cache indefinitely. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cross-origin (fonts, avatars from Google) and the API are left entirely
  // to the network — the API because of the medical/session data above.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
    return;
  }

  // Navigations go to the network first so a deploy is picked up
  // immediately; the cached shell is only a fallback for being offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(OFFLINE_URL, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          if (cached) return cached;
          throw new Error("Sem conexão e sem cópia local da página.");
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "FamilyCare", body: "Você tem um lembrete." };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    // Malformed payload: fall back to the generic message above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
