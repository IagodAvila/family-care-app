"use client";

import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Manual light/dark switch. Reads and writes `data-theme` on <html> directly
 * instead of going through React state: both icons are always rendered, and
 * CSS alone decides which one shows (see `.theme-icon-*` in globals.css).
 * That keeps the server-rendered markup and the first client render
 * identical, so there is no hydration mismatch to guard against — the
 * initial theme itself is resolved by the blocking script in layout.tsx.
 */
export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private browsing, quota); the toggle
      // still works for the rest of this page load.
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Alternar entre tema claro e escuro"
      onClick={toggleTheme}
    >
      <span aria-hidden="true" className="theme-icon theme-icon-sun">☀</span>
      <span aria-hidden="true" className="theme-icon theme-icon-moon">☾</span>
    </button>
  );
}
