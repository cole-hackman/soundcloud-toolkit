"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardFooter, LoadingSpinner, Button } from "@/components/ui";
import {
  ArrowUpRight,
  EyeOff,
  Lock,
  ShieldCheck,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

const trustItems = [
  { icon: ShieldCheck, label: "Secure OAuth" },
  { icon: EyeOff, label: "Read-only access" },
  { icon: Lock, label: "Revoke anytime" },
];

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

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,440px)] lg:gap-16">
          <section className="order-2 flex flex-col items-start lg:order-1 lg:pr-8">
            <Image
              src="/sc toolkit transparent .png"
              alt="SC Toolkit"
              width={140}
              height={46}
              className="h-8 w-auto object-contain"
              priority
              unoptimized
            />

            <h1 className="mt-10 text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl xl:text-6xl">
              Connect once.
              <br />
              <span className="text-gradient">Control every playlist.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Merge playlists, clean up likes, and keep your library show-ready.
            </p>
          </section>

          <section className="order-1 flex w-full justify-center lg:order-2 lg:justify-end">
            <div className="w-full max-w-md">
              <Card className="glass-card overflow-hidden rounded-[28px] border bg-surface/95 shadow-elevation-1">
                <CardHeader className="border-b border-border/60 px-5 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        SoundCloud OAuth
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-foreground sm:text-xl">
                        Connect your account
                      </h2>
                      <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground sm:text-sm">
                        We&apos;ll open the official SoundCloud approval screen.
                        Your password is never stored by SC Toolkit.
                      </p>
                    </div>
                    <Link
                      href="/"
                      className="hidden items-center gap-1 rounded-full border border-border/70 bg-surface/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
                    >
                      Home
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap gap-2 lg:hidden">
                    {trustItems.map((item) => (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface/80 px-3 py-1 text-[11px] text-foreground"
                      >
                        <item.icon className="h-3.5 w-3.5 text-primary" />
                        {item.label}
                      </span>
                    ))}
                  </div>

                  {apiUnreachable && (
                    <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                      <div className="text-xs font-semibold">
                        Backend not reachable
                      </div>
                      <div className="mt-1 text-[11px] leading-5 opacity-90">
                        Start the backend with{" "}
                        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/30">
                          npm run dev:server
                        </code>{" "}
                        and ensure{" "}
                        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/30">
                          .env
                        </code>{" "}
                        is set.
                      </div>
                      <Button
                        variant="ghost"
                        className="mt-2 h-8 px-2 text-[11px] text-amber-900 hover:bg-amber-100/80 dark:text-amber-50 dark:hover:bg-amber-900/60"
                        onClick={retryAuth}
                      >
                        Retry connection
                      </Button>
                    </div>
                  )}

                  <div className="rounded-2xl border border-border/60 bg-surface/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Fastest path to your tools
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          One approval unlocks playlist cleanup, combining,
                          sorting, and export workflows.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
                        <div className="text-lg font-semibold text-primary">
                          10+
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          tools
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="button"
                      onClick={prewarmAndLogin}
                      disabled={apiUnreachable || prewarming}
                      className="h-12 w-full rounded-2xl px-6 text-sm shadow-elevation-2 hover:shadow-glow-sm sm:h-13 sm:text-base"
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
                    <p className="text-center text-[11px] leading-5 text-muted-foreground">
                      You&apos;ll be redirected to SoundCloud to approve access,
                      then sent back here automatically.
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col items-center gap-4 border-t border-border/60 px-5 py-5 sm:px-6">
                  <p className="text-center text-[11px] leading-5 text-muted-foreground">
                    By connecting, you agree to our{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-primary hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <Link
                      className="transition-colors hover:text-primary"
                      href="/about"
                    >
                      About
                    </Link>
                    <Link
                      className="transition-colors hover:text-primary"
                      href="/privacy"
                    >
                      Privacy
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
