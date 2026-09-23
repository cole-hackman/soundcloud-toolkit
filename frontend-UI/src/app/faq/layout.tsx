import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ · Track Toolkit (formerly SC Toolkit)",
  description:
    "Answers about the rename from SoundCloud Toolkit to Track Toolkit, your account and data, the tools, and how to get help.",
  alternates: {
    canonical: "https://tracktoolkit.com/faq/",
  },
};

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
