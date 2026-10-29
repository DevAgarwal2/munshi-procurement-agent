import type { Metadata, Viewport } from "next";
import { Archivo, Noto_Sans_Devanagari, Noto_Sans_Gujarati } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
});

const gujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  variable: "--font-gujarati",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Munshi — Procurement, handled.",
  description:
    "Munshi is a buyer-side AI procurement agent. Describe the purchase; Munshi screens suppliers, calls them, normalises offers, and returns an evidence-backed decision.",
  applicationName: "Munshi",
};

export const viewport: Viewport = {
  themeColor: "#18231e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${devanagari.variable} ${gujarati.variable}`}>
      <body>{children}</body>
    </html>
  );
}
