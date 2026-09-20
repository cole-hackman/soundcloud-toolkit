import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { GoogleAnalytics } from "@/components/Analytics";
import { Providers } from "@/components/Providers";
import { RebrandBanner } from "@/components/RebrandBanner";
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
  title: "Track Toolkit – Organize, Merge & Clean SoundCloud Playlists",
  description:
    "Track Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
  keywords: [
    "Track Toolkit",
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
  authors: [{ name: "Track Toolkit" }],
  creator: "Track Toolkit",
  publisher: "Track Toolkit",
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
    canonical: "https://tracktoolkit.com/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tracktoolkit.com/",
    siteName: "Track Toolkit",
    title: "Track Toolkit – Organize, Merge & Clean SoundCloud Playlists",
    description:
      "Track Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
    images: [
      {
        url: "https://tracktoolkit.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Track Toolkit - Smarter SoundCloud Playlist Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Track Toolkit – Organize, Merge & Clean SoundCloud Playlists",
    description:
      "Track Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
    images: ["https://tracktoolkit.com/og-image.png"],
  },
  // The icon files keep their original names: the artwork itself still has to
  // be redrawn for Track Toolkit, and renaming the files without new art only
  // breaks the paths the Chrome extension and cached pages already point at.
  icons: {
    icon: "/SC Toolkit Icon.png",
    apple: "/SC Toolkit Icon.png",
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://tracktoolkit.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="canonical" href="https://tracktoolkit.com/" />
        <meta name="theme-color" content="#FF5500" />
      </head>
      <body className="antialiased font-sans">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <RebrandBanner />
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
        <SpeedInsights />
      </body>
    </html>
  );
}
