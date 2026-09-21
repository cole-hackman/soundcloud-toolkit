import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in · Track Toolkit",
  description:
    "Sign in to Track Toolkit with your SoundCloud account to manage playlists, likes, and followings.",
  alternates: {
    canonical: "https://tracktoolkit.com/login/",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
