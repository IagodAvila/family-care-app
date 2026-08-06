import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolveInitialThemeScript, THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const THEME_INIT_SCRIPT = resolveInitialThemeScript(THEME_STORAGE_KEY);

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "FamilyCare | Saúde da família ao seu alcance",
    description: "Dados de saúde da família organizados neste dispositivo para consulta rápida.",
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
      <body>
        {/* Blocking script, runs before hydration: sets `data-theme` on
            <html> from the stored preference (or the OS preference on a
            first visit) so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
