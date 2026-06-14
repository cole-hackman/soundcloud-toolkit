import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { siteMetadata } from "@/lib/seo/metadata";
import "./globals.css";
import { GoogleAnalytics } from "@/components/Analytics";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: siteMetadata.defaultTitle,
  description: siteMetadata.defaultDescription,
  keywords: [
    "SoundCloud",
    "playlist",
    "merge playlists",
    "organize playlists",
    "SoundCloud playlist tool",
    "merge SoundCloud playlists",
    "organize SoundCloud playlists",
    "playlist manager",
    "duplicate remover",
    "music organization",
  ],
  authors: [{ name: "SC Toolkit" }],
  creator: "SC Toolkit",
  publisher: "SC Toolkit",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteMetadata.siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteMetadata.siteUrl,
    siteName: "SC Toolkit",
    title: siteMetadata.defaultTitle,
    description: siteMetadata.defaultDescription,
    images: [
      {
        url: siteMetadata.ogImage,
        width: 1200,
        height: 630,
        alt: "SC Toolkit - Smarter SoundCloud Playlist Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteMetadata.defaultTitle,
    description: siteMetadata.defaultDescription,
    images: [siteMetadata.ogImage],
  },
  icons: {
    icon: "/SC Toolkit Icon.png",
    apple: "/SC Toolkit Icon.png",
  },
  manifest: "/manifest.json",
  metadataBase: new URL(siteMetadata.siteUrl),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        <meta name="theme-color" content="#FF5500" />
      </head>
      <body className="antialiased font-sans">
        <Providers>
          {children}
        </Providers>
        <GoogleAnalytics />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
