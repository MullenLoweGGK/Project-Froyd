import type { Metadata, Viewport } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { froydContent } from "@/lib/ldz-content";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Courses / PPDZ deployment — never index (branch `courses` → ppdz.froyd.app). */
const shouldNoIndex = process.env.NEXT_PUBLIC_NOINDEX !== "false";

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: froydContent.meta.title,
  description: froydContent.meta.description,
  robots: shouldNoIndex
    ? { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } }
    : { index: true, follow: true },
  openGraph: {
    title: froydContent.meta.title,
    description: froydContent.meta.description,
    locale: "sk_SK",
    type: "website",
    images: [
      {
        url: "/ldz/hero-illustration.png",
        width: 1200,
        height: 425,
        alt: "Liga za duševné zdravie — PPDZ nácvik",
      },
    ],
  },
  icons: {
    icon: "/ldz/favicon.ico",
    apple: "/ldz/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sk"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
