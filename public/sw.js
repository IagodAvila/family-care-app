/**
 * Service worker for medication-reminder push notifications. Deliberately
 * minimal — no offline caching/asset strategy, just push handling. See
 * app/components/push-notifications-toggle.tsx for how it's registered.
 */

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
      icon: "/favicon.svg",
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
