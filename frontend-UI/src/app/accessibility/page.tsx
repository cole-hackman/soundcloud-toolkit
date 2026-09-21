"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupportLink } from "@/components/SupportLink";

const LAST_REVIEWED = "2026-09-22";

// Seeded from the audit that drove this rewrite. Task 16 will prune this
// list as each item is fixed — remove an entry only once it's actually
// resolved, not when it merely looks fixed.
const KNOWN_ISSUES: string[] = [
  "The mobile navigation drawer is not yet a proper dialog for screen readers.",
  "Some bulk operations do not announce progress as they run.",
  "Some icon-only buttons lack accessible names.",
  "Some form fields lack visible labels.",
  "Orange text on light backgrounds is below 4.5:1 contrast in places.",
];

export default function AccessibilityPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground focus:outline-none">
      <div className="max-w-4xl mx-auto px-6 py-10 md:py-16">
        <article className="rounded-xl border border-border bg-surface p-8 shadow-elevation-1 md:p-12 dark:glass-card">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
            Accessibility Statement
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Last reviewed: {LAST_REVIEWED}
          </p>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Our target
              </h2>
              <p>
                Track Toolkit aims to meet WCAG 2.2 Level AA. No
                accessibility statute requires this of a free service run by
                one person — we&apos;re doing it anyway because it&apos;s the
                right bar to hold ourselves to.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Conformance status
              </h2>
              <p>
                Track Toolkit <strong className="text-foreground">partially
                conforms</strong> to WCAG 2.2 Level AA. &quot;Partially
                conforms&quot; means some parts of the site do not yet meet
                the standard — see Known issues below for the specifics we
                already know about.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                How we test
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  Automated axe checks at 1280px, 430px, 390px, and 360px
                  viewport widths
                </li>
                <li>Keyboard-only walkthroughs of every page and tool</li>
                <li>VoiceOver testing on iOS</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Known issues
              </h2>
              <p>
                These are the accessibility gaps we&apos;re aware of right
                now. This list shrinks as each one is fixed — it isn&apos;t
                exhaustive, and finding something that isn&apos;t listed here
                is useful feedback, not a surprise to us.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                {KNOWN_ISSUES.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Feedback
              </h2>
              <p>
                If you run into an accessibility barrier, we want to know
                about it.{" "}
                <SupportLink subject="Accessibility issue on Track Toolkit">
                  Email us
                </SupportLink>{" "}
                with what you were trying to do and what happened, or use the{" "}
                <Link
                  href="/feedback/"
                  className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                >
                  feedback form
                </Link>
                .
              </p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
