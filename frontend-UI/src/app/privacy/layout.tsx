import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Track Toolkit",
  description:
    "How Track Toolkit collects, stores, and protects your SoundCloud account data, including token encryption and data retention.",
  alternates: {
    canonical: "https://tracktoolkit.com/privacy/",
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
