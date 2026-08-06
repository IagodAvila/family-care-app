export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "familycare-theme";

/**
 * Runs before hydration (see the inline script in `app/layout.tsx`) and
 * again from `ThemeToggle` on click. Kept as plain, dependency-free JS so it
 * can be inlined into a blocking `<script>` tag as source text.
 */
export function resolveInitialThemeScript(storageKey: string): string {
  return `(function(){try{var s=localStorage.getItem(${JSON.stringify(storageKey)});var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;
}
