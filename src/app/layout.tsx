import type { Metadata } from "next";
import { Bebas_Neue, Gochi_Hand, Lobster, Montserrat } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

// Letreiro "Natal" e textos manuscritos, como na página do Natal Solidário.
const lobster = Lobster({
  variable: "--font-lobster",
  weight: "400",
  subsets: ["latin"],
});

const gochi = Gochi_Hand({
  variable: "--font-gochi",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doações para a Ceia de Natal 2026 | Missão Angelim",
  description:
    "Vamos fazer uma linda ceia de Natal para as famílias de Lagoa do Piauí! Escolha os itens que deseja doar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${bebas.variable} ${montserrat.variable} ${lobster.variable} ${gochi.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
