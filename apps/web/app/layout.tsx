import type { Metadata } from "next";
import "@finora/ui/tokens.css";
import "./globals.css";
import "./design.css";
import "./marketing-motion.css";
import "./product-motion.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
  ),
  title: "Finora · Sabé cuánto podés gastar antes de gastar",
  description:
    "Organizá tus ingresos, gastos, cuentas y cuotas. Conocé tus compromisos y proyectá los próximos 12 meses.",
  openGraph: {
    title: "Finora · Tu dinero, con claridad",
    description: "Registrá, planificá y decidí con números claros.",
    locale: "es_AR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
