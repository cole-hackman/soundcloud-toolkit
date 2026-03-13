"use client";

import Image from "next/image";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";
import { Button, Card } from "@/components/ui";
import {
  Layers,
  Heart,
  ArrowUpDown,
  Check,
  Lock,
  Shield,
  Radio,
  UserMinus,
  ThumbsDown,
  Download,
  HeartPulse,
  Link as LinkIcon,
  Music,
  Settings,
  LogIn,
} from "lucide-react";

// FAQ data - used for both display and structured data
const faqs = [
  {
    question: "Is SC Toolkit free to use?",
    answer: "Yes, SC Toolkit is completely free to use. We provide powerful playlist management and social tools at no cost to help you organize your SoundCloud music."
  },
  {
    question: "Do I need a SoundCloud Go+ or Pro subscription?",
    answer: "No! SC Toolkit works with all SoundCloud accounts, including free ones. You do not need a paid subscription to use any of our features."
  },
  {
    question: "How secure is my SoundCloud account?",
    answer: "Your account security is our top priority. We use official SoundCloud OAuth authentication, which means we never see or store your password. We only request the minimum permissions needed to manage your playlists, and all tokens are encrypted at rest with AES-256-GCM."
  },
  {
    question: "Can I merge playlists with more than 500 tracks?",
    answer: "Yes! When merging playlists that exceed 500 tracks, SC Toolkit automatically splits them into multiple playlists (e.g., Part 1/3, Part 2/3, Part 3/3) so you don't lose a single track."
  },
  {
    question: "What happens to my original playlists?",
    answer: "Your original playlists remain completely untouched. When you merge playlists or create new ones from your likes, we create new playlists rather than modifying existing ones. You have full control over your music library."
  },
  {
    question: "Can I see who doesn't follow me back?",
    answer: "Yes! The Following Manager compares your followers and following lists to show who doesn't follow you back. You can then bulk unfollow to clean up your social graph."
  },
  {
    question: "Can I download tracks from SoundCloud?",
    answer: "SC Toolkit helps you download tracks where the artist has enabled downloads or provided a purchase link. We respect artist preferences and never bypass download restrictions."
  },
  {
    question: "What is Activity to Playlist?",
    answer: "Activity to Playlist pulls the latest tracks from your SoundCloud activity feed — songs recently posted by artists you follow — and lets you save them as a new playlist before they get buried in your feed."
  },
  {
    question: "Does SC Toolkit work with private playlists?",
    answer: "Yes, SC Toolkit works with both public and private playlists. As long as you have access to the playlists through your SoundCloud account, you can use all our tools to organize them."
  }
];

// Features data
const features = [
  {
    icon: Layers,
    title: "Combine Playlists",
    description: "Merge multiple playlists into one unified collection. Automatically detect and remove duplicate tracks across all sources. Perfect for consolidating your music library."
  },
  {
    icon: Heart,
    title: "Likes → Playlist",
    description: "Transform your liked tracks into organized playlists. Select from thousands of favorites and batch-create playlists with custom names."
  },
  {
    icon: ArrowUpDown,
    title: "Playlist Modifier",
    description: "Take full control of your playlists. Reorder tracks with drag-and-drop, remove unwanted songs, and apply smart sorting by title, artist, date, duration, or BPM."
  },
  {
    icon: Download,
    title: "Downloads",
    description: "Download tracks directly where the artist has enabled downloads or provided a purchase link. No third-party downloaders needed."
  },
  {
    icon: Radio,
    title: "Activity to Playlist",
    description: "Turn your SoundCloud activity feed into a curated playlist. Capture recently posted tracks from artists you follow before they get buried."
  },
  {
    icon: UserMinus,
    title: "Following Manager",
    description: "See who doesn't follow you back, clean up your following list, and bulk unfollow accounts. Take control of your SoundCloud social graph."
  },
  {
    icon: ThumbsDown,
    title: "Like Manager",
    description: "Browse, search, and bulk unlike tracks to keep your liked collection focused. Clean up thousands of stale likes in seconds."
  },
  {
    icon: HeartPulse,
    title: "Playlist Health Check",
    description: "Scan your playlists for blocked, deleted, or unstreamable tracks and clean them up. Keep your playlists in perfect shape."
  },
  {
    icon: LinkIcon,
    title: "Link Resolver",
    description: "Get instant metadata from any SoundCloud URL. Resolve tracks, playlists, and user profiles to extract detailed information."
  }
];

// Benefits data
const benefits = [
  "Merge multiple playlists with automatic duplicate removal",
  "Turn liked tracks or activity feed into organized playlists",
  "Download tracks with available download or purchase links",
  "Manage your following list — find who doesn't follow back",
  "Bulk operations: unlike tracks, unfollow users, resolve links",
  "Smart playlist health checks for blocked or deleted tracks",
  "Dark and light theme to match your preference",
  "100% free with secure OAuth — your password is never stored"
];

// User personas (kept from Next.js version as it's good content)
const userTypes = [
  {
    title: "DJs & Producers",
    description:
      "Build perfect sets by merging genre-specific playlists. Organize tracks by BPM for seamless mixing. Keep your crate digging discoveries organized."
  },
  {
    title: "Music Curators",
    description:
      "Manage large collections across multiple playlists. Remove duplicates that accumulate over time. Create themed compilations by combining your best discoveries."
  },
  {
    title: "Collectors & Archivists",
    description:
      "Archive your liked tracks before they disappear. Organize years of music discovery into meaningful collections. Never lose a track to content changes."
  },
  {
    title: "Power Listeners",
    description:
      "Tame playlist sprawl with smart organization tools. Create the perfect workout, study, or mood playlists. Enjoy your music without the clutter of duplicates."
  }
];

// Steps data from Home.tsx
const steps = [
  {
    step: "1",
    icon: LogIn,
    title: "Connect",
    description: "Sign in securely with your SoundCloud account using OAuth",
  },
  {
    step: "2",
    icon: Settings,
    title: "Organize",
    description:
      "Use 10+ powerful tools to merge, sort, clean, and manage your library",
  },
  {
    step: "3",
    icon: Music,
    title: "Enjoy",
    description: "Export your organized playlists back to SoundCloud instantly",
  },
];

export default function Home() {
  const scrollToFeatures = () => {
    const el = document.getElementById("features");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <StructuredData faqs={faqs} />

      <div className="min-h-screen bg-background text-foreground">
        {/* Navigation */}
        <nav className="fixed inset-x-0 top-0 z-40 flex items-center justify-center pt-4 sm:pt-6">
          <div className="mx-auto flex w-full max-w-6xl px-4 sm:px-6">
            <div className="glass-card flex w-full items-center justify-between rounded-full border px-4 py-2 sm:px-6 sm:py-3">
              <div className="flex items-center gap-2">
                <Image
                  src="/sc toolkit transparent .png"
                  alt="SC Toolkit Logo"
                  width={120}
                  height={40}
                  className="h-8 w-auto object-contain sm:h-10"
                  priority
                  unoptimized
                />
              </div>
              <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm text-muted-foreground md:flex">
                <a href="#features" className="hover:text-foreground transition">
                  Features
                </a>
                <a href="#benefits" className="hover:text-foreground transition">
                  Benefits
                </a>
                <a
                  href="#how-it-works"
                  className="hover:text-foreground transition"
                >
                  How It Works
                </a>
                <a href="#faq" className="hover:text-foreground transition">
                  FAQ
                </a>
              </div>
              <div className="flex items-center">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-glow-sm hover:-translate-y-0.5 sm:px-6 sm:py-2 sm:text-sm"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-32 md:pb-28 md:pt-40">
          <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[480px] bg-[radial-gradient(circle_at_top,_rgba(255,85,0,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.18),transparent_55%)]" />

          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary" />
              SoundCloud playlist power tools — free forever
            </div>

            <h1 className="mt-6 animate-fade-in-up text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl [animation-delay:80ms]">
              The Ultimate SoundCloud{" "}
              <span className="text-gradient font-semibold">Toolkit</span>
            </h1>

            <p className="mt-5 max-w-2xl animate-fade-in-up text-balance text-base text-muted-foreground sm:text-lg md:text-xl [animation-delay:160ms]">
              Organize playlists, clean your library, and tame your SoundCloud
              chaos with a focused console of tools — built for curators,
              DJs, and power listeners.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 [animation-delay:220ms]">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold shadow-elevation-2 transition-all duration-150 hover:shadow-glow-sm hover:-translate-y-0.5 bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Connect with SoundCloud
              </Link>
              <Button
                type="button"
                variant="secondary"
                onClick={scrollToFeatures}
                className="rounded-full px-6 py-2"
              >
                See what it does
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground sm:text-sm">
              Free to use. No credit card. Just OAuth.
            </p>
          </div>
        </section>

        {/* Social proof / trust bar */}
        <section className="border-y border-border/60 bg-surface px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Trusted by SoundCloud power users
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Lock, label: "Secure OAuth", description: "Official SoundCloud login" },
                { icon: Shield, label: "No password storage", description: "Tokens encrypted at rest" },
                { icon: Heart, label: "Loved by curators", description: "Playlists without the chaos" },
                { icon: Layers, label: "Playlist safe", description: "Originals stay untouched" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/80 px-4 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section
          id="features"
          className="px-4 py-20 sm:px-6 sm:py-24 lg:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                A console of tools for{" "}
                <span className="text-gradient">total control</span>.
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Merge, clean, and re-shape your SoundCloud world without
                wrestling the UI. Every tool is tuned for large libraries and
                obsessive curators.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "Playlists, without the mess", description: "Combine playlists, remove duplicates, and keep everything in sync.", href: "/combine", Icon: Layers, wide: true },
                { name: "Likes → playlists, automatically", description: "Turn years of likes into themed, export-ready playlists.", href: "/likes-to-playlist", Icon: Heart, wide: false },
                { name: "Health checks for every set", description: "Find blocked, deleted, and unstreamable tracks before a show.", href: "/playlist-health-check", Icon: HeartPulse, wide: false },
                { name: "Social graph control", description: "See who doesn’t follow back, batch unfollow, and clean your feed.", href: "/following-manager", Icon: UserMinus, wide: false },
              ].map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={item.wide ? "sm:col-span-2 lg:col-span-2" : ""}
                >
                  <Card
                    interactive
                    className="h-full p-5 transition-all hover:border-primary/60"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                    <span className="mt-3 inline-block text-[11px] font-medium text-primary">
                      Open →
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits section */}
        <section
          id="benefits"
          className="border-y border-border/60 bg-surface px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Built for the{" "}
              <span className="text-gradient">obsessed listeners</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-center text-base text-muted-foreground sm:text-lg">
              Whether you&apos;re a DJ, curator, or collector, SC Toolkit
              gives you the levers to keep everything sharp, searchable, and
              show-ready.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="glass-card flex items-start gap-4 rounded-xl border bg-surface/80 p-6"
                >
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-relaxed text-foreground sm:text-base">
                    {benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="bg-background/80 px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground sm:text-lg">
              Three steps, one clean library. No spreadsheets, no hacks — just
              tools that speak SoundCloud.
            </p>

            <div className="relative mt-14 grid gap-8 rounded-3xl border border-border/70 bg-surface/70 p-8 shadow-elevation-1 sm:grid-cols-3 sm:p-10">
              {steps.map((item, i) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.title}
                    className="relative flex flex-col items-center text-center"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-surface text-sm font-semibold text-muted-foreground">
                      {item.step}
                    </div>
                    <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <IconComponent className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="border-y border-border/60 bg-surface px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Ready to organize your SoundCloud like a studio session?
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Connect once, pick a tool, and let SC Toolkit handle the
              tedious parts — so you can listen, sort, and play.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg px-10 py-3 text-base font-semibold shadow-elevation-2 transition-all duration-150 hover:shadow-glow-sm hover:-translate-y-0.5 bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Connect with SoundCloud
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="bg-background px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Frequently asked
            </h2>
            <div className="mt-10 space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-border/70 bg-surface/80"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
                    <h3 className="pr-4 text-left text-sm font-medium text-foreground sm:text-base">
                      {faq.question}
                    </h3>
                    <span className="text-lg text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pt-0 sm:px-6 sm:pb-5">
                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {faq.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/60 bg-background/90 px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row sm:text-sm">
              <div className="flex items-center gap-4">
                <Link
                  href="/about"
                  className="hover:text-foreground transition-colors"
                >
                  About
                </Link>
                <span className="hidden sm:inline">•</span>
                <Link
                  href="/privacy"
                  className="hover:text-foreground transition-colors"
                >
                  Privacy
                </Link>
                <span className="hidden sm:inline">•</span>
                <Link
                  href="https://github.com/"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </Link>
              </div>
              <div className="text-center sm:text-right">
                <p>SC Toolkit is not affiliated with SoundCloud.</p>
                <p className="mt-1">
                  © {new Date().getFullYear()} SC Toolkit. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
