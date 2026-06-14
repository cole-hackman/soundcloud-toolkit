"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { StructuredData } from "@/components/StructuredData";
import { Button, Card } from "@/components/ui";
import { ShimmerButton } from "@/components/ui/ShimmerButton";
import { TypingAnimation } from "@/components/ui/TypingAnimation";
import { WordRotate } from "@/components/ui/WordRotate";
import { AnimatedShinyText } from "@/components/ui/AnimatedShinyText";
import { AnimatedGradientText } from "@/components/ui/AnimatedGradientText";
import { ShineBorder } from "@/components/ui/ShineBorder";
import { GlareHover } from "@/components/ui/GlareHover";
import { TextAnimate } from "@/components/ui/TextAnimate";
import {
  Layers,
  Heart,
  Check,
  Lock,
  Shield,
  UserMinus,
  HeartPulse,
  Music,
  Settings,
  LogIn,
  ArrowRight,
} from "lucide-react";

const FlickeringGrid = dynamic(
  () => import("@/components/ui/FlickeringGrid").then((mod) => mod.FlickeringGrid),
  { ssr: false }
);

const Meteors = dynamic(
  () => import("@/components/ui/Meteors").then((mod) => mod.Meteors),
  { ssr: false }
);

const faqs = [
  {
    question: "Is SC Toolkit free to use?",
    answer:
      "Yes, SC Toolkit is completely free to use. We provide powerful playlist management and social tools at no cost to help you organize your SoundCloud music.",
  },
  {
    question: "Do I need a SoundCloud Go+ or Pro subscription?",
    answer:
      "No! SC Toolkit works with all SoundCloud accounts, including free ones. You do not need a paid subscription to use any of our features.",
  },
  {
    question: "How secure is my SoundCloud account?",
    answer:
      "Your account security is our top priority. We use official SoundCloud OAuth authentication, which means we never see or store your password. We only request the minimum permissions needed to manage your playlists, and all tokens are encrypted at rest with AES-256-GCM.",
  },
  {
    question: "Can I merge playlists with more than 500 tracks?",
    answer:
      "Yes! When merging playlists that exceed 500 tracks, SC Toolkit automatically splits them into multiple playlists (e.g., Part 1/3, Part 2/3, Part 3/3) so you don't lose a single track.",
  },
  {
    question: "What happens to my original playlists?",
    answer:
      "Your original playlists remain completely untouched. When you merge playlists or create new ones from your likes, we create new playlists rather than modifying existing ones. You have full control over your music library.",
  },
  {
    question: "Can I see who doesn't follow me back?",
    answer:
      "Yes! The Following Manager compares your followers and following lists to show who doesn't follow you back. You can then bulk unfollow to clean up your social graph.",
  },
  {
    question: "Can I download tracks from SoundCloud?",
    answer:
      "SC Toolkit helps you download tracks where the artist has enabled downloads or provided a purchase link. We respect artist preferences and never bypass download restrictions.",
  },
  {
    question: "What is Activity to Playlist?",
    answer:
      "Activity to Playlist pulls the latest tracks from your SoundCloud activity feed — songs recently posted by artists you follow — and lets you save them as a new playlist before they get buried in your feed.",
  },
  {
    question: "Does SC Toolkit work with private playlists?",
    answer:
      "Yes, SC Toolkit works with both public and private playlists. As long as you have access to the playlists through your SoundCloud account, you can use all our tools to organize them.",
  },
];

const benefits = [
  "Merge multiple playlists with automatic duplicate removal",
  "Turn liked tracks or activity feed into organized playlists",
  "Download tracks with available download or purchase links",
  "Manage your following list — find who doesn't follow back",
  "Bulk operations: unlike tracks, unfollow users, resolve links",
  "Smart playlist health checks for blocked or deleted tracks",
  "Dark and light theme to match your preference",
  "100% free with secure OAuth — your password is never stored",
];

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

export default function HomePageClient() {
  const scrollToFeatures = () => {
    const el = document.getElementById("features");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <StructuredData faqs={faqs} />
      <Script
        src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"
        data-name="bmc-button"
        data-slug="hackman"
        data-color="#fcffff"
        data-emoji="☕"
        data-font="Lato"
        data-text="Support Me"
        data-outline-color="#000000"
        data-font-color="#000000"
        data-coffee-color="#FFDD00"
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-background text-foreground">
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
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-glow-sm hover:-translate-y-0.5 sm:px-6 sm:py-2 sm:text-sm"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-32 md:pb-28 md:pt-40">
          <div className="pointer-events-none absolute inset-0 -z-20 opacity-60">
            <FlickeringGrid
              squareSize={4}
              gridGap={6}
              flickerChance={0.15}
              color="rgb(255, 85, 0)"
              maxOpacity={0.12}
              className="h-full w-full"
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[480px] bg-[radial-gradient(circle_at_top,_rgba(255,85,0,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.18),transparent_55%)]" />

          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary" />
              SoundCloud playlist power tools — free forever
            </div>

            <h1 className="mt-6 animate-fade-in-up text-balance font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl [animation-delay:80ms]">
              The Ultimate SoundCloud{" "}
              <AnimatedGradientText
                className="inline-flex font-semibold"
                colorFrom="#ff5500"
                colorTo="#ffc14a"
              >
                Toolkit
              </AnimatedGradientText>
            </h1>

            <div className="mt-4 flex animate-fade-in-up items-center justify-center gap-2 text-base font-semibold text-muted-foreground sm:text-lg md:text-xl [animation-delay:120ms]">
              <WordRotate
                words={["Merge.", "Split.", "Clean.", "Organize."]}
                className="text-primary"
                duration={2200}
              />
              <span className="text-muted-foreground/60">your music library.</span>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 [animation-delay:220ms]">
              <Link href="/login">
                <ShimmerButton
                  shimmerColor="#ffb347"
                  background="rgba(255, 85, 0, 1)"
                  borderRadius="8px"
                  shimmerDuration="2.5s"
                  className="shadow-elevation-2 hover:shadow-glow-sm hover:-translate-y-0.5 transition-transform"
                >
                  Connect with SoundCloud
                </ShimmerButton>
              </Link>
              <Button
                type="button"
                variant="secondary"
                onClick={scrollToFeatures}
                className="rounded-lg px-6 py-2"
              >
                See what it does
              </Button>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-surface px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground sm:text-base">
              Trusted by 2,000+ DJs & producers
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

        <section id="features" className="px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                <span className="block">A console of tools for</span>
                <span className="block text-gradient mt-2">total control</span>
              </h2>
              <div className="mt-4 flex items-center justify-center text-base text-muted-foreground sm:text-lg">
                Built for{" "}
                <TypingAnimation
                  words={["DJs & producers.", "music curators.", "power listeners.", "collectors."]}
                  className="ml-1 font-semibold text-foreground"
                  typeSpeed={70}
                  deleteSpeed={35}
                  pauseDelay={1800}
                  loop
                  showCursor
                  blinkCursor
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { name: "Playlists, without the mess", description: "Combine playlists, remove duplicates, and keep everything in sync.", href: "/combine", Icon: Layers, badge: "Most Popular" },
                { name: "Likes → playlists, automatically", description: "Turn years of likes into themed, export-ready playlists.", href: "/likes-to-playlist", Icon: Heart, badge: "New" },
                { name: "Health checks for every set", description: "Find blocked, deleted, and unstreamable tracks before a show.", href: "/playlist-health-check", Icon: HeartPulse, badge: undefined },
                { name: "Social graph control", description: "See who doesn't follow back, batch unfollow, and clean your feed.", href: "/following-manager", Icon: UserMinus, badge: undefined },
              ].map((item) => (
                <ShineBorder key={item.href} color="#FF5500" borderRadius={12}>
                  <Link href={item.href} className="block h-full">
                    <GlareHover className="rounded-xl h-full">
                      <Card
                        interactive
                        className="h-full p-5 transition-all hover:border-primary/60"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <item.Icon className="h-5 w-5" />
                          </div>
                          {item.badge && (
                            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                              <AnimatedShinyText className="text-primary">
                                {item.badge}
                              </AnimatedShinyText>
                            </span>
                          )}
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
                    </GlareHover>
                  </Link>
                </ShineBorder>
              ))}
            </div>
          </div>
        </section>

        <section
          id="benefits"
          className="border-y border-border/60 bg-surface px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              <TextAnimate animation="slideLeft" by="character">
                Built for the obsessed listeners.
              </TextAnimate>
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-center text-base text-muted-foreground sm:text-lg">
              Whether you&apos;re a DJ, curator, or collector, SC Toolkit
              gives you the levers to keep everything sharp, searchable, and
              show-ready.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <ShineBorder key={benefit} color="#FF5500" borderRadius={12}>
                  <GlareHover className="rounded-xl h-full">
                    <Card
                      interactive
                      className="flex h-full items-start gap-4 p-5 transition-all hover:border-primary/60"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Check className="h-5 w-5" />
                      </div>
                      <p className="min-w-0 text-sm leading-relaxed text-foreground">
                        {benefit}
                      </p>
                    </Card>
                  </GlareHover>
                </ShineBorder>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="bg-background/80 px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              How it works
            </h2>

            <div className="relative mt-12 grid gap-8 rounded-3xl border border-border/70 bg-surface/70 p-8 shadow-elevation-1 sm:grid-cols-3 sm:p-10">
              {steps.map((item, i) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.title}
                    className="relative flex flex-col items-center text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <IconComponent className="h-7 w-7" />
                    </div>
                    {i < steps.length - 1 && (
                      <div className="hidden sm:block absolute top-4 -right-[2.5rem] text-muted-foreground/30">
                        <ArrowRight className="h-6 w-6" />
                      </div>
                    )}
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

        <section className="relative overflow-hidden border-y border-border/60 bg-surface px-4 py-20 sm:px-6 sm:py-24">
          <Meteors number={18} minDuration={4} maxDuration={12} angle={215} className="opacity-30" />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Ready to organize your SoundCloud like a studio session?
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Connect once, pick a tool, and let SC Toolkit handle the
              tedious parts — so you can listen, sort, and play.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/login">
                <ShimmerButton
                  shimmerColor="#ffb347"
                  background="rgba(255, 85, 0, 1)"
                  borderRadius="8px"
                  shimmerDuration="2.5s"
                  className="shadow-elevation-2 px-10 py-3 text-base transition-transform hover:-translate-y-0.5 hover:shadow-glow-sm"
                >
                  Connect with SoundCloud
                </ShimmerButton>
              </Link>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="bg-background px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
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

        <footer className="border-t border-border/60 bg-background/90 px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row sm:text-sm">
              <div className="flex items-center gap-4">
                <Link href="/about" className="transition-colors hover:text-foreground">
                  About
                </Link>
                <span className="hidden sm:inline">•</span>
                <Link href="/privacy" className="transition-colors hover:text-foreground">
                  Privacy
                </Link>
              </div>
              <div className="text-center sm:text-right">
                <p>SC Toolkit is not affiliated with SoundCloud.</p>
                <p className="mt-1">© 2026 SC Toolkit. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
