import type { Metadata } from "next";
import { headers } from "next/headers";
import { Manrope, Sora } from "next/font/google";
import { resolveInitialThemeScript, THEME_STORAGE_KEY } from "@/lib/theme";
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

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "FamilyCare | Saúde da família ao seu alcance",
    description: "Dados de saúde da família sincronizados com segurança para consulta rápida.",
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
        {children}
      </body>
    </html>
  );
}
