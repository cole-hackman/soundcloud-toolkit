import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy – SC Toolkit",
  description:
    "Learn how SC Toolkit protects your privacy and handles your SoundCloud data. We use OAuth authentication and never store your password.",
  alternates: {
    canonical: "https://www.soundcloudtoolkit.com/privacy",
  },
  openGraph: {
    title: "Privacy Policy – SC Toolkit",
    description:
      "Learn how SC Toolkit protects your privacy and handles your SoundCloud data. We use OAuth authentication and never store your password.",
    url: "https://www.soundcloudtoolkit.com/privacy",
    type: "website",
  },
};

export default function PrivacyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <article className="bg-white rounded-2xl p-8 md:p-12 shadow-lg">
          <div className="mb-6">
            <Link
              href="/"
              className="text-[#FF5500] hover:text-[#E64A00] transition inline-flex items-center gap-2"
            >
              <span>←</span> Back to Home
            </Link>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-[#333333]">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#999999] mb-8">
            Last updated: {lastUpdated}
          </p>

          <div className="space-y-8 text-[#666666] leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Introduction
              </h2>
              <p>
                SC Toolkit (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
                is committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your
                information when you use our web application. Please read this
                privacy policy carefully. If you do not agree with the terms of
                this privacy policy, please do not access the application.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Authentication & Account Access
              </h2>
              <p>
                SC Toolkit uses SoundCloud&apos;s official OAuth 2.0
                authentication system with PKCE (Proof Key for Code Exchange)
                for secure login. This means:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>
                  We <strong className="text-[#333333]">never</strong> see,
                  store, or have access to your SoundCloud password
                </li>
                <li>
                  Authentication is handled entirely through SoundCloud&apos;s
                  secure servers
                </li>
                <li>
                  We only receive temporary access tokens that you can revoke at
                  any time
                </li>
                <li>
                  All tokens are encrypted at rest using AES-256-GCM encryption
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Data We Access
              </h2>
              <p>
                SC Toolkit requests the minimum permissions necessary to
                function:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>
                  <strong className="text-[#333333]">
                    Read access to your playlists:
                  </strong>{" "}
                  To display and manage your playlists
                </li>
                <li>
                  <strong className="text-[#333333]">
                    Read access to your likes:
                  </strong>{" "}
                  To convert liked tracks into playlists
                </li>
                <li>
                  <strong className="text-[#333333]">
                    Write access to playlists:
                  </strong>{" "}
                  To create, modify, and organize playlists
                </li>
                <li>
                  <strong className="text-[#333333]">
                    Read access to your profile:
                  </strong>{" "}
                  To display your username and basic account information
                </li>
              </ul>
              <p className="mt-4">
                We do <strong className="text-[#333333]">not</strong> access
                your private messages, comments, reposts, or any other
                SoundCloud data beyond what is necessary for playlist
                management.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                How We Store Your Data
              </h2>
              <p>
                When you authenticate with SC Toolkit, we store the following
                information in our database:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Your SoundCloud user ID (numeric identifier)</li>
                <li>Your SoundCloud username and display name</li>
                <li>Your profile avatar URL</li>
                <li>
                  Encrypted access and refresh tokens (AES-256-GCM encryption)
                </li>
                <li>Token expiration timestamps</li>
              </ul>
              <p className="mt-4">
                All sensitive data (access tokens) is encrypted at rest using
                industry-standard AES-256-GCM encryption with a 32-character
                encryption key. Session cookies are HMAC-signed and marked as
                HttpOnly and Secure in production.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Data Usage
              </h2>
              <p>We use your data solely to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>
                  Provide playlist management features (merge, organize, modify
                  playlists)
                </li>
                <li>Convert your liked tracks into playlists</li>
                <li>Resolve SoundCloud links to extract metadata</li>
                <li>Maintain your session while using the application</li>
              </ul>
              <p className="mt-4">
                We do <strong className="text-[#333333]">not</strong>:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Sell, rent, or share your data with third parties</li>
                <li>Use your data for advertising or marketing purposes</li>
                <li>Analyze your listening habits or preferences</li>
                <li>
                  Store your playlist content or track information beyond
                  what&apos;s necessary for API calls
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Data Retention
              </h2>
              <p>
                We retain your account information and encrypted tokens as long
                as your account is active. If you wish to delete your data, you
                can:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>
                  Log out of SC Toolkit (this clears your session but keeps
                  account data)
                </li>
                <li>
                  Revoke access through your SoundCloud account settings (this
                  prevents future access)
                </li>
                <li>Contact us to request complete data deletion</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Cookies & Session Management
              </h2>
              <p>
                SC Toolkit uses secure, HttpOnly cookies to maintain your
                session. These cookies:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Are signed with HMAC to prevent tampering</li>
                <li>Are marked as Secure in production (HTTPS only)</li>
                <li>
                  Use SameSite=None for cross-site cookie support (with proper
                  CORS configuration)
                </li>
                <li>
                  Do not contain sensitive information (only session
                  identifiers)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Third-Party Services
              </h2>
              <p>SC Toolkit integrates with:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>
                  <strong className="text-[#333333]">SoundCloud API:</strong>{" "}
                  For authentication and playlist management
                </li>
                <li>
                  <strong className="text-[#333333]">Vercel Analytics:</strong>{" "}
                  For anonymous usage analytics (no personal data collected)
                </li>
              </ul>
              <p className="mt-4">
                We do not share your personal data with any third-party services
                beyond what is necessary for the application to function.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Your Rights
              </h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Access your stored data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Revoke access to your SoundCloud account at any time</li>
                <li>Export your data (where technically feasible)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Security Measures
              </h2>
              <p>
                We implement industry-standard security measures to protect your
                data:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>AES-256-GCM encryption for sensitive data at rest</li>
                <li>HTTPS/TLS encryption for all data in transit</li>
                <li>HMAC-signed session cookies</li>
                <li>Secure CORS configuration with allowlist</li>
                <li>Regular security audits and updates</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Children&apos;s Privacy
              </h2>
              <p>
                SC Toolkit is not intended for users under the age of 13. We do
                not knowingly collect personal information from children under
                13. If you are a parent or guardian and believe your child has
                provided us with personal information, please contact us to have
                that information removed.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page and updating the &quot;Last updated&quot; date. You
                are advised to review this Privacy Policy periodically for any
                changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">
                Contact Us
              </h2>
              <p>
                If you have any questions about this Privacy Policy or our data
                practices, please contact us through the appropriate channels.
                We are committed to transparency and will respond to your
                inquiries promptly.
              </p>
            </section>

            <div className="pt-6 border-t border-gray-200">
              <p className="text-sm text-[#999999]">
                <strong className="text-[#333333]">Disclaimer:</strong> SC
                Toolkit is not affiliated with, endorsed by, or connected to
                SoundCloud. This is an independent tool created to enhance the
                SoundCloud user experience. Your use of SC Toolkit is subject to
                SoundCloud&apos;s Terms of Service and this Privacy Policy.
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

