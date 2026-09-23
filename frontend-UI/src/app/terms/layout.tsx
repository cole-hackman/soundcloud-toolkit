import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Track Toolkit",
  description:
    "The terms that govern using Track Toolkit — eligibility, acceptable use, account deletion, and liability.",
  alternates: {
    canonical: "https://tracktoolkit.com/terms/",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
