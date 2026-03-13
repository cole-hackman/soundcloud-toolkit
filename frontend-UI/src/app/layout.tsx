import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { GoogleAnalytics } from "@/components/Analytics";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/react";

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
  title: "SC Toolkit – Organize, Merge & Clean SoundCloud Playlists",
  description:
    "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
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
    canonical: "https://www.soundcloudtoolkit.com/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.soundcloudtoolkit.com/",
    siteName: "SC Toolkit",
    title: "SC Toolkit – Organize, Merge & Clean SoundCloud Playlists",
    description:
      "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
    images: [
      {
        url: "https://www.soundcloudtoolkit.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "SC Toolkit - Smarter SoundCloud Playlist Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SC Toolkit – Organize, Merge & Clean SoundCloud Playlists",
    description:
      "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
    images: ["https://www.soundcloudtoolkit.com/og-image.png"],
  },
  icons: {
    icon: "/SC Toolkit Icon.png",
    apple: "/SC Toolkit Icon.png",
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://www.soundcloudtoolkit.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="canonical" href="https://www.soundcloudtoolkit.com/" />
        <meta name="theme-color" content="#FF5500" />
      </head>
      <body className="antialiased font-sans">
        <Providers>
          {children}
        </Providers>
        <Script
          src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"
          data-name="bmc-button"
          data-slug="hackman"
          data-color="#fcffff"
          data-emoji="☕"
          data-font="Lato"
          data-text="Support Me"
          data-outline-color="#000000"
          data-font-color="#000000"
          data-coffee-color="#FFDD00"
          strategy="afterInteractive"
        />
        <GoogleAnalytics />
        <Analytics />
      </body>
    </html>
  );
}
