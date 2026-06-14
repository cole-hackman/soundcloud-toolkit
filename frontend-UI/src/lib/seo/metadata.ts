import type { Metadata } from "next";

const siteUrl = "https://www.soundcloudtoolkit.com";
const defaultTitle = "SC Toolkit – Organize, Merge & Clean SoundCloud Playlists";
const defaultDescription =
  "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.";

type PublicMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export const siteMetadata = {
  siteUrl,
  defaultTitle,
  defaultDescription,
  ogImage: `${siteUrl}/og-image.png`,
};

export function buildPublicMetadata({
  title,
  description,
  path,
}: PublicMetadataInput): Metadata {
  const normalizedPath = path === "/" ? "/" : path.replace(/\/?$/, "/");
  const url = `${siteUrl}${normalizedPath === "/" ? "/" : normalizedPath}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: "SC Toolkit",
      title,
      description,
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
      title,
      description,
      images: [siteMetadata.ogImage],
    },
  };
}
