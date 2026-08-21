import type { Metadata } from "next";
import { Urbanist, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import MxScrollReveal from "@/components/MxScrollReveal";

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  title: "Creador de apps con IA",
  description: "Diseña, genera e itera apps React con IA. Vista previa en vivo.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`mx ${urbanist.variable} ${geistSans.variable} ${geistMono.variable} ${robotoMono.variable}`}
        style={{ fontFamily: "var(--font-urbanist), Urbanist, system-ui, sans-serif" }}
      >
        <MxScrollReveal />
        {children}
      </body>
    </html>
  );
}
