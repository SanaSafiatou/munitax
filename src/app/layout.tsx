import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MuniTax · Collecte des taxes municipales",
    template: "%s · MuniTax",
  },
  description:
    "Plateforme de démonstration pour la collecte digitale des taxes municipales : paiement en ligne simulé pour les contribuables, encaissement terrain par les agents et suivi en temps réel par la mairie.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#065f46",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
