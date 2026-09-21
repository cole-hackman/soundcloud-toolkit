import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Track Toolkit",
  description:
    "Track Toolkit is an independent web app that helps SoundCloud users merge, organize, and clean up playlists beyond what the official platform offers.",
  alternates: {
    canonical: "https://tracktoolkit.com/about/",
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
