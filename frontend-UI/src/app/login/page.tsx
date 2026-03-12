"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, LoadingSpinner } from "@/components/ui";
import { Layers, Heart, ListChecks, Link as LinkIcon, Moon, Sun, Lock } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function LoginPage() {
  const { isAuthenticated, loading, login, apiUnreachable, retryAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [prewarming, setPrewarming] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  // Pre-warm API before redirecting to reduce cold-start hiccups
  const prewarmAndLogin = async () => {
    if (apiUnreachable || prewarming) return;
    setPrewarming(true);
    try {
      await Promise.race([
        fetch(`${API_BASE}/health`, { credentials: "include" }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    } catch {
      // Ignore errors
    }
    try {
      // one retry if it was asleep
      await Promise.race([
        fetch(`${API_BASE}/health`, { credentials: "include" }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    } catch {
      // Ignore errors
    }
    try {
      login();
    } finally {
      setPrewarming(false);
    }
  };

  const features = useMemo(
    () => [
      { icon: Layers, title: "Combine playlists", desc: "Merge multiple playlists, remove duplicates." },
      { icon: Heart, title: "Likes → playlist", desc: "Turn favorites into organized collections." },
      { icon: ListChecks, title: "Bulk tools", desc: "Unlike, unfollow, and clean up fast." },
      { icon: LinkIcon, title: "Resolve links", desc: "Extract metadata from any SoundCloud URL." },
    ],
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* subtle background */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#FF5500]/10 via-transparent to-transparent dark:from-[#FF5500]/15" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4">
        <div className="w-full max-w-[520px]">
          {/* Top row */}
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              SC Toolkit
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>

          <Card className="p-6 sm:p-8 shadow-md hover:shadow-md">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6 mt-2">
            <Image
              src="/sc toolkit transparent .png"
              alt="SC Toolkit"
              width={180}
              height={60}
              className="w-[140px] sm:w-[180px] object-contain"
              priority
            />
          </div>

          {/* Headline */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              Smarter SoundCloud Playlists
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Organize playlists, manage your library, and run bulk cleanups—fast.
            </p>
          </div>

          {/* Trust row */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5">
              <Lock className="h-3.5 w-3.5 text-[#FF5500]" />
              OAuth login (no password stored)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5">
              Free to use
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5">
              Light / dark theme
            </span>
          </div>

          {/* Features */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map((f, index) => (
              <div key={index} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF5500]/10 text-[#FF5500]">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{f.title}</div>
                  <div className="text-sm text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* API unreachable message */}
          {apiUnreachable && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="text-sm font-semibold">Backend not reachable</div>
              <div className="mt-1 text-xs opacity-90">
                Start the backend with{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/30">npm run dev:full</code>{" "}
                and ensure <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/30">.env</code> is set.
              </div>
              <button
                type="button"
                onClick={retryAuth}
                className="mt-2 text-xs font-semibold text-[#FF5500] hover:underline"
              >
                Retry connection
              </button>
            </div>
          )}

          {/* Login Button */}
          <div className="hidden sm:flex flex-col gap-2">
            <button
              onClick={prewarmAndLogin}
              disabled={apiUnreachable || prewarming}
              className="w-full mx-auto flex items-center justify-center rounded-lg bg-gradient-to-r from-[#FF5500] to-[#E64A00] hover:brightness-95 text-white py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prewarming ? (
                <>
                  <LoadingSpinner size="sm" className="border-white" />
                  Warming up…
                </>
              ) : (
                <span className="whitespace-nowrap">Continue with SoundCloud</span>
              )}
            </button>
            <p className="text-xs text-center text-muted-foreground">
              You’ll be redirected to SoundCloud to approve access.
            </p>
          </div>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-4 mt-6 text-sm text-muted-foreground">
            <Link className="hover:text-[#FF5500] transition" href="/about">
              About
            </Link>
            <Link className="hover:text-[#FF5500] transition" href="/privacy">
              Privacy
            </Link>
          </div>
          </Card>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur border-t border-border p-3">
        <button
          onClick={prewarmAndLogin}
          disabled={apiUnreachable || prewarming}
          className="w-full flex items-center justify-center rounded-lg bg-gradient-to-r from-[#FF5500] to-[#E64A00] hover:brightness-95 text-white py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {prewarming ? (
            <>
              <LoadingSpinner size="sm" className="border-white" />
              Warming up…
            </>
          ) : (
            <span className="whitespace-nowrap">Continue with SoundCloud</span>
          )}
        </button>
      </div>
    </div>
  );
}

