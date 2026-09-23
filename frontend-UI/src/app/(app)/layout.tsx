import type { Metadata } from "next";
import { AppGroupLayout } from "./AppGroupLayout";

// The authenticated tool routes carry a signed-in user's session state and
// have nothing to offer a search index; keep them out of it.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AppLayoutRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppGroupLayout>{children}</AppGroupLayout>;
}
