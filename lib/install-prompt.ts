"use client";

/**
 * Keeps hold of the browser's `beforeinstallprompt` event so the app can
 * offer its own "Instalar app" action.
 *
 * Chrome only fires this event once per page load, early — and it stops
 * showing its own install banner for months once the user dismisses it,
 * which otherwise leaves no way back into installing. Listening at module
 * scope (this file is imported at page load via the account menu) means
 * the event is captured even though the menu item that uses it renders
 * much later, only once the menu is opened.
 *
 * Safari/iOS never fires this event at all — there, installing is manual
 * ("Compartilhar > Adicionar à Tela de Início"), so callers should fall
 * back to instructions rather than a button.
 */

/** The slice of `BeforeInstallPromptEvent` we use; it isn't in TS's DOM lib. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppresses Chrome's own banner so it doesn't compete with our button
    // — and, crucially, keeps the event usable later instead of it being
    // consumed by a banner the user may just dismiss.
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

export function subscribeToInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function canInstall() {
  return deferredPrompt !== null;
}

/** Server snapshot for `useSyncExternalStore` — there's no install prompt while rendering on the server. */
export function canInstallOnServer() {
  return false;
}

/** Whether the app is already running as an installed PWA, in which case there's nothing to offer. */
export function isRunningStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true
    // iOS Safari predates `display-mode` and exposes this instead.
    || (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** Shows the browser's install dialog. Returns whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  // The event can only be used once, so it's cleared up front — a second
  // click would otherwise throw.
  deferredPrompt = null;
  emit();

  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}
