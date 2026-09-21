"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupportLink } from "@/components/SupportLink";

const LAST_UPDATED = "2026-09-22";

// Cole's decision, recorded in global-constraints.md: left as a clearly
// marked placeholder until a state is chosen. Do not fill this in without
// checking with him first.
const GOVERNING_LAW_STATE = "[STATE]";

export default function TermsPage() {
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

          <h1 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                1. Who provides the service
              </h2>
              <p>
                Track Toolkit is operated by Cole Hackman, an individual, in
                the United States. There is no company behind the product —
                support requests, legal notices, and everything else reach
                the same person.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                2. What the service is
              </h2>
              <p>
                Track Toolkit is a web application that helps SoundCloud
                users manage playlists, likes, and followings in bulk —
                merging playlists past the 500-track limit, cleaning up likes
                and follows, resolving links, and similar tools. It connects
                to your SoundCloud account through SoundCloud&apos;s own
                OAuth login.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                3. Eligibility
              </h2>
              <p>
                You must be at least 13 years old to use Track Toolkit, and
                you need a SoundCloud account to sign in — Track Toolkit
                doesn&apos;t create or manage SoundCloud accounts itself. You
                are responsible for your own SoundCloud account and for
                anything done through it using Track Toolkit.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                4. Your SoundCloud account and content
              </h2>
              <p>
                SoundCloud&apos;s own Terms of Use govern the tracks,
                playlists, and other content in your account — using Track
                Toolkit doesn&apos;t change that relationship. The tools act
                only on the actions you start: merging the playlists you
                select, unliking the tracks you choose, and so on — nothing
                runs on your account without you triggering it. The Growth
                tools follow or like only the accounts and tracks you
                explicitly select; they never act on your behalf beyond your
                selection.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                5. Acceptable use
              </h2>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Scrape or bulk-extract data from Track Toolkit</li>
                <li>
                  Circumvent rate limits or other technical limits we put in
                  place
                </li>
                <li>Use Track Toolkit to violate SoundCloud&apos;s own Terms of Use</li>
                <li>
                  Access Track Toolkit programmatically outside the web app
                  and the official Track Toolkit Chrome extension
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                6. What we may do
              </h2>
              <p>
                To keep the service running for everyone, we may rate-limit
                requests, pause or change individual features, suspend
                accounts that abuse the service or attempt to circumvent
                these limits, and change or discontinue tools at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                7. Free service, no warranty
              </h2>
              <p>
                Track Toolkit is provided free of charge, &quot;as is,&quot;
                with no guarantee of uptime or availability. SoundCloud can
                change its own API at any time, and a change on their end can
                break a Track Toolkit feature without warning. Bulk actions —
                merges, bulk unlike, bulk unfollow, and similar operations —
                are generally irreversible once submitted, so review your
                selection before confirming.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                8. Limitation of liability
              </h2>
              <p>
                To the extent permitted by law, Track Toolkit and its
                operator are not liable for indirect, incidental, or
                consequential damages arising from your use of the service.
                Because Track Toolkit is free, our total liability for any
                claim is capped at the amount you paid to use it — which is
                zero.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                9. Deleting your account and ending these terms
              </h2>
              <p>
                You can delete your Track Toolkit account at any time from
                the Account page; deletion removes what we store about you
                and ends these terms between us. We may also end these terms
                and your access if you violate them — most likely by
                suspending the account, as described above.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                10. Changes to these terms
              </h2>
              <p>
                We may update these terms from time to time. When we do, we
                post the new version here and update the date at the top of
                this page — continued use of Track Toolkit after a change
                means you accept the update.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                11. No affiliation with SoundCloud
              </h2>
              <p>
                Track Toolkit is an independent product and is not
                affiliated with, endorsed by, or sponsored by SoundCloud.
                &quot;SoundCloud&quot; is a trademark of its respective
                owner; we reference it only to describe the platform Track
                Toolkit connects to.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                12. Governing law and disputes
              </h2>
              <p>
                These terms are governed by the laws of the State of{" "}
                <strong className="text-foreground">
                  {GOVERNING_LAW_STATE}
                </strong>
                {GOVERNING_LAW_STATE === "[STATE]" && (
                  <span> (to be confirmed)</span>
                )}
                , without regard to its conflict-of-law provisions. If a
                dispute comes up,{" "}
                <SupportLink subject="Track Toolkit dispute">
                  contact us
                </SupportLink>{" "}
                first — most issues get resolved a lot faster by email than
                any formal process.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                13. Contact
              </h2>
              <p>
                Questions about these terms?{" "}
                <SupportLink subject="Track Toolkit terms question">
                  Email us
                </SupportLink>
                .
              </p>
            </section>

            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Source code:</strong> The
                source code is available under the license in the
                repository&apos;s LICENSE file.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Track
                Toolkit is not affiliated with, endorsed by, or connected to
                SoundCloud. This is an independent tool created to enhance
                the SoundCloud user experience.
              </p>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
