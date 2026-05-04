import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { poolDisplay } from "@/lib/fonts";
import { SITE_TITLE } from "@/lib/site-metadata";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Fantasy playoff pool standings, day scoring, and live NHL scores with box scores.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_TITLE,
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_TITLE}`,
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${poolDisplay.variable} h-full antialiased`}
    >
      <body
        className={`${geistSans.className} min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
