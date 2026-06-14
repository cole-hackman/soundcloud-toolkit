import type { Metadata } from "next";
import HomePageClient from "@/components/home/HomePageClient";
import { buildPublicMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPublicMetadata({
  title: "SC Toolkit – Organize, Merge & Clean SoundCloud Playlists",
  description:
    "SC Toolkit helps SoundCloud power users organize, merge, and clean playlists. Remove duplicates, manage tracks, and build better playlists faster.",
  path: "/",
});

export default function HomePage() {
  return <HomePageClient />;
}
