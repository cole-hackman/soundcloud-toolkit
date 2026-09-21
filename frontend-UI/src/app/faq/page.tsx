"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StructuredData, type FAQ } from "@/components/StructuredData";
import { SupportLink } from "@/components/SupportLink";

// The rename FAQ, always expanded — this is the content people arrive
// looking for, from a redirected bookmark or a search result. Plain text
// answers live alongside a `link` so the same content can render with a
// working <Link> on the page and as plain text in the FAQPage JSON-LD.
interface RebrandFaq {
  question: string;
  answer: string;
}

const rebrandFaqs: RebrandFaq[] = [
  {
    question: "Is Track Toolkit the same as SC Toolkit / SoundCloud Toolkit?",
    answer:
      "Yes. It's the same product, the same tools, the same account, and the same data — there's nothing to set up again.",
  },
  {
    question: "Why did the name change?",
    answer:
      "SoundCloud's API Terms of Use don't allow “SoundCloud” or a derivation of it in an app's name or domain, and the product was called SoundCloud Toolkit. SoundCloud still shows up wherever it's factual — you connect with SoundCloud, and every tool acts on your SoundCloud account. Track Toolkit is not affiliated with SoundCloud.",
  },
  {
    question: "Do I need to log in again?",
    answer:
      "Once. Sessions were reset when the site moved on 2026-09-20, so you'll see the same “Continue with SoundCloud” button and approve access one more time.",
  },
  {
    question: "What happens to my soundcloudtoolkit.com links and bookmarks?",
    answer:
      "They redirect to the same page on tracktoolkit.com, path and query included — update bookmarks whenever it's convenient. A page that no longer exists shows a “That page isn't here” page with links back into the app.",
  },
];

// Rendered as plain text in the JSON-LD; the on-page version below adds the
// two links (Privacy, Account) inline.
const dataChangeFaq: FAQ = {
  question: "Did anything change about my data?",
  answer:
    "No. See the Privacy Policy for exactly what's stored, and the Account page for your own data and deletion options.",
};

// Accounts and login — how to disconnect, delete, and what deletion removes.
const accountFaqs: FAQ[] = [
  {
    question: "How do I disconnect Track Toolkit from my SoundCloud account?",
    answer:
      "Revoke access from SoundCloud's own settings (Settings → Connected apps), or disconnect from the Account page inside Track Toolkit. Either one stops future access immediately.",
  },
  {
    question: "How do I delete my Track Toolkit account?",
    answer:
      "Open the Account page and choose Delete account. That's separate from disconnecting on SoundCloud, and it permanently removes what we store about you.",
  },
  {
    question: "What does deleting my account remove?",
    answer:
      "Your stored tokens, profile info, and operation history are deleted from our database. See the Privacy Policy for exactly what's kept and for how long.",
  },
];

// The tools — migrated verbatim from the landing page's original FAQ list.
const toolFaqs: FAQ[] = [
  {
    question: "Is Track Toolkit free to use?",
    answer:
      "Yes, Track Toolkit is completely free to use. We provide powerful playlist management and social tools at no cost to help you organize your SoundCloud music.",
  },
  {
    question: "Do I need a SoundCloud Go+ or Pro subscription?",
    answer:
      "No! Track Toolkit works with all SoundCloud accounts, including free ones. You do not need a paid subscription to use any of our features.",
  },
  {
    question: "How secure is my SoundCloud account?",
    answer:
      "Your account security is our top priority. We use official SoundCloud OAuth authentication, which means we never see or store your password. We only request the minimum permissions needed to manage your playlists, and all tokens are encrypted at rest with AES-256-GCM.",
  },
  {
    question: "Can I merge playlists with more than 500 tracks?",
    answer:
      "Yes! When merging playlists that exceed 500 tracks, Track Toolkit automatically splits them into multiple playlists (e.g., Part 1/3, Part 2/3, Part 3/3) so you don't lose a single track.",
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
      "Track Toolkit helps you download tracks where the artist has enabled downloads or provided a purchase link. We respect artist preferences and never bypass download restrictions.",
  },
  {
    question: "What is Activity to Playlist?",
    answer:
      "Activity to Playlist pulls the latest tracks from your SoundCloud activity feed — songs recently posted by artists you follow — and lets you save them as a new playlist before they get buried in your feed.",
  },
  {
    question: "Does Track Toolkit work with private playlists?",
    answer:
      "Yes, Track Toolkit works with both public and private playlists. As long as you have access to the playlists through your SoundCloud account, you can use all our tools to organize them.",
  },
];

// Your data — kept short; the Privacy Policy is the source of truth.
const privacyFaqs: FAQ[] = [
  {
    question: "What does Track Toolkit store about me?",
    answer:
      "We store your SoundCloud profile basics (ID, username, avatar), encrypted OAuth tokens, and a log of the operations you run — nothing else. See the Privacy Policy for the full breakdown.",
  },
  {
    question: "Do you use analytics cookies or trackers?",
    answer:
      "No. Track Toolkit doesn't run any analytics, advertising, or tracking cookies — there's nothing to opt out of because nothing is being tracked.",
  },
];

const supportFaqs: FAQ[] = [
  {
    question: "How do I report a bug or ask for a feature?",
    answer:
      "Use the feedback form to send a bug report or feature request — it's the fastest way to get it in front of Cole. You can also email support directly.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Email support and include your SoundCloud username and the tool you were using so we can help faster. We usually respond within a few days.",
  },
];

const allFaqs: FAQ[] = [
  ...rebrandFaqs,
  dataChangeFaq,
  ...accountFaqs,
  ...toolFaqs,
  ...privacyFaqs,
  ...supportFaqs,
];

function FaqDetails({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-border/70 bg-surface/80">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold text-foreground sm:px-6">
        <span className="text-left text-sm sm:text-base">{question}</span>
        <span className="shrink-0 text-lg text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="px-4 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:pb-5 sm:text-base">
        {children}
      </div>
    </details>
  );
}

export default function FaqPage() {
  return (
    <>
      <StructuredData faqs={allFaqs} />

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
              Frequently asked questions
            </h1>
            <p className="mb-10 max-w-2xl text-muted-foreground leading-relaxed">
              Answers about the rename from SoundCloud Toolkit (SC Toolkit) to
              Track Toolkit, your account and data, the tools, and how to get
              help.
            </p>

            <section id="rebrand" className="mb-12 scroll-mt-24">
              <h2 className="text-2xl font-bold mb-5 text-foreground">
                The rename
              </h2>
              <div className="space-y-6">
                {rebrandFaqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="text-base font-semibold text-foreground sm:text-lg">
                      {faq.question}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {faq.answer}
                    </p>
                  </div>
                ))}
                <div>
                  <h3 className="text-base font-semibold text-foreground sm:text-lg">
                    {dataChangeFaq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    No. See the{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                    >
                      Privacy Policy
                    </Link>{" "}
                    for exactly what&apos;s stored, and the{" "}
                    <Link
                      href="/account/"
                      className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                    >
                      Account page
                    </Link>{" "}
                    for your own data and deletion options.
                  </p>
                </div>
              </div>
            </section>

            <section id="accounts" className="mb-12 scroll-mt-24">
              <h2 className="text-2xl font-bold mb-5 text-foreground">
                Accounts and login
              </h2>
              <div className="space-y-3">
                <FaqDetails question={accountFaqs[0].question}>
                  <p>
                    Revoke access from SoundCloud&apos;s own settings
                    (Settings &rarr; Connected apps), or disconnect from the{" "}
                    <Link
                      href="/account/"
                      className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                    >
                      Account page
                    </Link>{" "}
                    inside Track Toolkit. Either one stops future access
                    immediately.
                  </p>
                </FaqDetails>
                <FaqDetails question={accountFaqs[1].question}>
                  <p>
                    Open the{" "}
                    <Link
                      href="/account/"
                      className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                    >
                      Account page
                    </Link>{" "}
                    and choose Delete account. That&apos;s separate from
                    disconnecting on SoundCloud, and it permanently removes
                    what we store about you.
                  </p>
                </FaqDetails>
                <FaqDetails question={accountFaqs[2].question}>
                  <p>
                    Your stored tokens, profile info, and operation history
                    are deleted from our database. See the{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                    >
                      Privacy Policy
                    </Link>{" "}
                    for exactly what&apos;s kept and for how long.
                  </p>
                </FaqDetails>
              </div>
            </section>

            <section id="tools" className="mb-12 scroll-mt-24">
              <h2 className="text-2xl font-bold mb-5 text-foreground">
                The tools
              </h2>
              <div className="space-y-3">
                {toolFaqs.map((faq) => (
                  <FaqDetails key={faq.question} question={faq.question}>
                    <p>{faq.answer}</p>
                  </FaqDetails>
                ))}
              </div>
            </section>

            <section id="privacy" className="mb-12 scroll-mt-24">
              <h2 className="text-2xl font-bold mb-5 text-foreground">
                Your data
              </h2>
              <div className="space-y-3">
                <FaqDetails question={privacyFaqs[0].question}>
                  <p>
                    We store your SoundCloud profile basics (ID, username,
                    avatar), encrypted OAuth tokens, and a log of the
                    operations you run — nothing else. See the{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                    >
                      Privacy Policy
                    </Link>{" "}
                    for the full breakdown.
                  </p>
                </FaqDetails>
                <FaqDetails question={privacyFaqs[1].question}>
                  <p>{privacyFaqs[1].answer}</p>
                </FaqDetails>
              </div>
            </section>

            <section id="support" className="scroll-mt-24">
              <h2 className="text-2xl font-bold mb-5 text-foreground">
                Help and feedback
              </h2>
              <div className="space-y-3">
                <FaqDetails question={supportFaqs[0].question}>
                  <p>
                    Use the{" "}
                    <Link
                      href="/feedback/"
                      className="font-medium text-foreground underline underline-offset-2 transition hover:text-primary"
                    >
                      feedback form
                    </Link>{" "}
                    to send a bug report or feature request — it&apos;s the
                    fastest way to get it in front of Cole. You can also{" "}
                    <SupportLink subject="Track Toolkit support">
                      email support
                    </SupportLink>{" "}
                    directly.
                  </p>
                </FaqDetails>
                <FaqDetails question={supportFaqs[1].question}>
                  <p>
                    Email{" "}
                    <SupportLink subject="Track Toolkit support">
                      support
                    </SupportLink>{" "}
                    and include your SoundCloud username and the tool you were
                    using, so we can help faster. We usually respond within a
                    few days.
                  </p>
                </FaqDetails>
              </div>
            </section>
          </article>
        </div>
      </main>
    </>
  );
}
