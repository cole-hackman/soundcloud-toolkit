import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

// The console's readouts (counts, latencies, ids, timestamps) are set in a
// monospace face so columns of numbers line up. Loaded through next/font like
// the two brand faces in the root layout, so it is self-hosted and never a
// runtime @import from Google.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Admin console · Track Toolkit",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${mono.variable} admin-root`}>{children}</div>;
}
