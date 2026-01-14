import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@/components/Analytics";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="canonical" href="https://www.soundcloudtoolkit.com/" />
        <meta name="theme-color" content="#FF5500" />
      </head>
      <body className="antialiased font-sans">
        <Providers>
          {children}
        </Providers>
        <GoogleAnalytics />
        <Analytics />
      </body>
    </html>
  );
}
