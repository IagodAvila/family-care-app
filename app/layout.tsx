import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Manrope, Sora } from "next/font/google";
import { resolveInitialThemeScript, THEME_STORAGE_KEY } from "@/lib/theme";
import { ServiceWorkerRegistration } from "./components/service-worker-registration";
import "./globals.css";

const THEME_INIT_SCRIPT = resolveInitialThemeScript(THEME_STORAGE_KEY);

// Sora for titles (used at weight 600 throughout), Manrope for body copy —
// exposed as CSS variables so globals.css can reference them with a plain
// system-font fallback chain if a font ever fails to load.
const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

export const viewport: Viewport = {
  // Tints the Android status bar to match the topbar, per theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f7773" },
    { media: "(prefers-color-scheme: dark)", color: "#23272c" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "FamilyCare | Saúde da família ao seu alcance",
    description: "Dados de saúde da família sincronizados com segurança para consulta rápida.",
    manifest: "/manifest.webmanifest",
    // iOS uses its own touch icon rather than the manifest's icons.
    //
    // `statusBarStyle` is deliberately "default" (opaque) and not
    // "black-translucent": the translucent style makes the status bar
    // overlay the page, which is only safe with `viewport-fit=cover` plus
    // `env(safe-area-inset-top)` padding — and vinext's viewport shim has
    // no `viewportFit` support (it only emits width/height/scale), so the
    // topbar would end up under the clock on a notched iPhone.
    appleWebApp: {
      capable: true,
      title: "FamilyCare",
      statusBarStyle: "default",
    },
    icons: {
      icon: "/favicon.svg",
      apple: "/icons/apple-touch-icon.png",
    },
    other: {
      // vinext emits only the modern `mobile-web-app-capable`; iOS before
      // 16.4 looks for the apple-prefixed one to run standalone.
      "apple-mobile-web-app-capable": "yes",
    },
    openGraph: {
      title: "FamilyCare | Dados de saúde da família",
      description: "Dados de saúde da família organizados para consulta rápida.",
      url: base,
      siteName: "FamilyCare",
      locale: "pt_BR",
      type: "website",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "FamilyCare, dados de saúde da família" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "FamilyCare | Dados de saúde da família",
      description: "Dados de saúde da família organizados para consulta rápida.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} ${manrope.variable}`}>
        {/* Blocking script, runs before hydration: sets `data-theme` on
            <html> from the stored preference (or the OS preference on a
            first visit) so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
