import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility Statement · Track Toolkit",
  description:
    "Track Toolkit's commitment to WCAG 2.1 AA accessibility, current known limitations, and how to report an accessibility barrier.",
  alternates: {
    canonical: "https://tracktoolkit.com/accessibility/",
  },
};

export default function AccessibilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
