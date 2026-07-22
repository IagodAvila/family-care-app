import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "FamilyCare | Saúde da família ao seu alcance",
    description: "Organize dados médicos essenciais dos seus familiares e acesse tudo rapidamente em uma emergência.",
    openGraph: {
      title: "FamilyCare | Informação certa, na hora que importa",
      description: "Dados essenciais de saúde da sua família, organizados para quando cada segundo conta.",
      url: base,
      siteName: "FamilyCare",
      locale: "pt_BR",
      type: "website",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "FamilyCare, informação certa na hora que importa" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "FamilyCare | Informação certa, na hora que importa",
      description: "Dados essenciais de saúde da sua família, organizados para emergências.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
