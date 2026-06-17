"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
            Accessibility Statement
          </h1>

          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-lg">
              SC Toolkit is committed to ensuring digital accessibility for people
              with disabilities. We are continually improving the user experience
              for everyone and applying the relevant accessibility standards to
              ensure our application is usable by all music lovers.
            </p>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Conformance Status
              </h2>
              <p>
                The Web Content Accessibility Guidelines (WCAG) defines requirements
                for designers and developers to improve accessibility for people with
                disabilities. It defines three levels of conformance: Level A, Level
                AA, and Level AAA.
              </p>
              <p className="mt-2">
                SC Toolkit aims to adhere as closely as possible to the WCAG 2.1 Level
                AA standards. We strive to provide an inclusive experience, though we
                recognize that some areas of the site may still need improvement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Accessibility Features
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>
                  <strong className="text-foreground">Keyboard Navigation:</strong>{" "}
                  Most of our interactive elements and pages can be navigated using
                  standard keyboard controls (Tab, Enter, Space, and Arrow keys).
                </li>
                <li>
                  <strong className="text-foreground">Screen Reader Support:</strong>{" "}
                  We use semantic HTML and ARIA labels where appropriate to provide
                  context and meaning to screen reader users.
                </li>
                <li>
                  <strong className="text-foreground">Color Contrast:</strong>{" "}
                  We have carefully selected our color palette in both light and
                  dark modes to ensure sufficient contrast for readability.
                </li>
                <li>
                  <strong className="text-foreground">Focus Indicators:</strong>{" "}
                  Clear focus indicators are provided for links, buttons, and form
                  inputs to help users track their location on the page.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Current Limitations
              </h2>
              <p>
                Despite our best efforts to ensure accessibility of SC Toolkit, there
                may be some limitations. Below is a description of known limitations:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2 mb-4">
                <li>
                  <strong className="text-foreground">Third-Party Content:</strong>{" "}
                  Some embedded content, such as SoundCloud widgets or external links,
                  may not be fully accessible, as they are controlled by third
                  parties.
                </li>
                <li>
                  <strong className="text-foreground">Drag and Drop:</strong>{" "}
                  Certain features, like reordering tracks via drag and drop, might
                  have limited keyboard accessibility. We are actively exploring
                  alternative ways to provide this functionality.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Feedback
              </h2>
              <p>
                We welcome your feedback on the accessibility of SC Toolkit. If you
                encounter any accessibility barriers or have suggestions on how we
                can improve, please don&apos;t hesitate to reach out.
              </p>
            </section>

            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> This statement
                was last updated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
