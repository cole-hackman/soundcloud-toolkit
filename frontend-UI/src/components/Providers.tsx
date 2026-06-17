"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppQueryProvider } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppQueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </AppQueryProvider>
    </ThemeProvider>
  );
}
