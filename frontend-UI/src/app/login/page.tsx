"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardFooter, LoadingSpinner, Button } from "@/components/ui";
import { Lock, ShieldCheck, EyeOff } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function LoginPage() {
  const { isAuthenticated, loading, login, apiUnreachable, retryAuth } = useAuth();
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(255,85,0,0.08),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(37,99,235,0.08),transparent_50%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 md:flex-row md:items-center md:justify-between md:py-10">
        {/* Left: branding panel */}
        <section className="flex flex-1 flex-col justify-center gap-6 md:pr-8">
          <div>
            <h1 className="text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
              Connect once.
              <br />
              <span className="text-gradient">Control every playlist.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm text-muted-foreground sm:text-base">
              Securely link your SoundCloud account to merge playlists, clean
              your library, and keep every set show‑ready.
            </p>
          </div>
        </section>

        {/* Right: login card */}
        <section className="flex w-full max-w-md flex-col">
          <Card className="glass-card rounded-2xl border bg-surface/95 shadow-elevation-1">
            <CardHeader className="border-b border-border/60 px-5 py-4">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                Connect your SoundCloud
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                We&apos;ll open an official SoundCloud OAuth window. No password
                is ever stored.
              </p>
            </CardHeader>

            <CardContent className="space-y-5 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface/80 px-3 py-1 text-[11px] text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Secure OAuth
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface/80 px-3 py-1 text-[11px] text-foreground">
                  <EyeOff className="h-3.5 w-3.5 text-primary" />
                  Read‑only access
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface/80 px-3 py-1 text-[11px] text-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Revoke anytime
                </span>
              </div>

              {apiUnreachable && (
                <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 p-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="text-xs font-semibold">
                    Backend not reachable
                  </div>
                  <div className="mt-1 text-[11px] opacity-90">
                    Start the backend with{" "}
                    <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/30">
                      npm run dev:full
                    </code>{" "}
                    and ensure{" "}
                    <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/30">
                      .env
                    </code>{" "}
                    is set.
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-2 h-7 px-2 text-[11px] text-amber-900 hover:bg-amber-100/80 dark:text-amber-50 dark:hover:bg-amber-900/60"
                    onClick={retryAuth}
                  >
                    Retry connection
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={prewarmAndLogin}
                  disabled={apiUnreachable || prewarming}
                  className="w-full rounded-xl px-6 py-3 shadow-elevation-2 hover:shadow-glow-sm"
                >
                  {prewarming ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner size="sm" className="border-white" />
                      Warming up…
                    </span>
                  ) : (
                    <span className="whitespace-nowrap">
                      Continue with SoundCloud
                    </span>
                  )}
                </Button>
                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                  You&apos;ll be redirected to SoundCloud to approve access.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col items-center gap-3 border-t border-border/60 px-5 py-4">
              <p className="text-center text-[11px] text-muted-foreground">
                By connecting, you agree to our{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-primary hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </CardFooter>
          </Card>

          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link className="hover:text-primary transition-colors" href="/about">
              About
            </Link>
            <Link
              className="hover:text-primary transition-colors"
              href="/privacy"
            >
              Privacy
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

