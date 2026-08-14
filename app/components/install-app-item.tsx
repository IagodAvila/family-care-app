"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  canInstall,
  canInstallOnServer,
  isRunningStandalone,
  promptInstall,
  subscribeToInstallPrompt,
} from "@/lib/install-prompt";

const IOS_PATTERN = /iPad|iPhone|iPod/;

/**
 * Account-menu entry for installing the app.
 *
 * Chrome/Android capture the browser's install prompt (see
 * lib/install-prompt.ts) and this offers it back as a button — the only
 * reliable way in once someone has dismissed the browser's own one-shot
 * banner, since Chrome then withholds it for months. iOS Safari never fires
 * that event at all, so it gets manual instructions instead of a button.
 * Renders nothing once the app is already running installed.
 */
export function InstallAppItem() {
  const installable = useSyncExternalStore(subscribeToInstallPrompt, canInstall, canInstallOnServer);
  // Both start "as if installed" so the server render and the first client
  // render match; the effect below corrects it right after mount.
  const [standalone, setStandalone] = useState(true);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Reads happen through a microtask (rather than synchronously in the
    // effect body) so this stays a "sync external state after mount"
    // update rather than a same-pass render loop.
    queueMicrotask(() => {
      setStandalone(isRunningStandalone());
      setIsIos(IOS_PATTERN.test(navigator.userAgent));
    });
  }, []);

  if (standalone) return null;

  if (installable) {
    return (
      <button
        className="user-menu-item user-menu-item--toggle"
        type="button"
        role="menuitem"
        onClick={() => promptInstall()}
      >
        Instalar app
      </button>
    );
  }

  if (isIos) {
    return (
      <p className="user-menu-item user-menu-note" role="note">
        Para instalar: toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
      </p>
    );
  }

  return null;
}
