import Image from "next/image";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";

// FAQ data - used for both display and structured data
const faqs = [
  {
    question: "Is SC Toolkit free to use?",
    answer:
      "Yes, SC Toolkit is completely free to use. We provide powerful playlist management tools at no cost to help you organize your SoundCloud music. There are no hidden fees, premium tiers, or subscription requirements.",
  },
  {
    question: "How secure is my SoundCloud account?",
    answer:
      "Your account security is our top priority. We use official SoundCloud OAuth authentication, which means we never see or store your password. We only request the minimum permissions needed to manage your playlists, and all tokens are encrypted at rest using AES-256-GCM encryption.",
  },
  {
    question: "Can I merge playlists with more than 500 tracks?",
    answer:
      "SoundCloud has a limit of 500 tracks per playlist. When merging playlists, we automatically cap the result at 500 tracks and remove duplicates to ensure your merged playlist is valid. If you have more tracks, we'll include the first 500 unique tracks.",
  },
  {
    question: "What happens to my original playlists?",
    answer:
      "Your original playlists remain completely untouched. When you merge playlists or create new ones from your likes, we create new playlists rather than modifying existing ones. You have full control over your music library.",
  },
  {
    question: "Can I undo changes made to my playlists?",
    answer:
      "When using the Playlist Modifier, you can undo the last applied order. However, we recommend being careful with playlist modifications as SoundCloud doesn't provide a built-in undo feature. Always review changes before saving.",
  },
  {
    question: "Does SC Toolkit work with private playlists?",
    answer:
      "Yes, SC Toolkit works with both public and private playlists. As long as you have access to the playlists through your SoundCloud account, you can use all our tools to organize them.",
  },
  {
    question: "How does SC Toolkit handle duplicate tracks?",
    answer:
      "Our smart deduplication system identifies duplicate tracks across your playlists by comparing track IDs, titles, and artists. When merging playlists or cleaning up your library, duplicates are automatically detected and you can choose to remove them with a single click.",
  },
  {
    question: "Is SC Toolkit affiliated with SoundCloud?",
    answer:
      "No, SC Toolkit is not affiliated with, endorsed by, or connected to SoundCloud. This is an independent tool created to enhance the SoundCloud user experience. We use SoundCloud's official public API with proper OAuth authentication.",
  },
];

// Features data
const features = [
  {
    icon: "⊞",
    title: "Combine Playlists",
    description:
      "Merge multiple playlists into one unified collection. Automatically detect and remove duplicate tracks across all sources. Perfect for consolidating your music library or creating mega-playlists from your favorite collections.",
  },
  {
    icon: "♥",
    title: "Likes to Playlist",
    description:
      "Transform your liked tracks into organized playlists. Select from thousands of favorites and batch-create playlists with custom names. Never lose track of your favorite discoveries again.",
  },
  {
    icon: "⇅",
    title: "Playlist Modifier",
    description:
      "Take full control of your playlists. Reorder tracks with drag-and-drop, remove unwanted songs, and apply smart sorting by title, artist, date, duration, or BPM. Your playlists, your way.",
  },
  {
    icon: "🔗",
    title: "Link Resolver",
    description:
      "Get instant metadata from any SoundCloud URL. Resolve tracks, playlists, and user profiles to extract detailed information. Perfect for research, organization, and discovery.",
  },
];

// Benefits data
const benefits = [
  "Organize thousands of tracks with advanced playlist management tools",
  "Automatically detect and remove duplicate tracks across playlists",
  "Batch edit and reorganize your entire music library efficiently",
  "Get insights and analytics from SoundCloud links and metadata",
  "Smart sorting algorithms (by BPM, duration, artist, date added)",
  "No limits - handle playlists with hundreds of tracks at once",
];

// User personas
const userTypes = [
  {
    title: "DJs & Producers",
    description:
      "Build perfect sets by merging genre-specific playlists. Organize tracks by BPM for seamless mixing. Keep your crate digging discoveries organized and ready for your next performance.",
  },
  {
    title: "Music Curators",
    description:
      "Manage large collections across multiple playlists. Remove duplicates that accumulate over time. Create themed compilations by combining your best discoveries.",
  },
  {
    title: "Collectors & Archivists",
    description:
      "Archive your liked tracks before they disappear. Organize years of music discovery into meaningful collections. Never lose a track to SoundCloud's content changes.",
  },
  {
    title: "Power Listeners",
    description:
      "Tame playlist sprawl with smart organization tools. Create the perfect workout, study, or mood playlists. Enjoy your music without the clutter of duplicates.",
  },
];

// Problems we solve
const problems = [
  {
    title: "Duplicate Tracks Everywhere",
    description:
      "The same track appears in multiple playlists, cluttering your library and making listening repetitive. Our deduplication tools scan across all your playlists to identify and remove duplicates.",
  },
  {
    title: "Playlist Sprawl",
    description:
      "Years of saving tracks has left you with dozens of disorganized playlists. Combine related playlists into cohesive collections without losing any tracks.",
  },
  {
    title: "Manual Reordering Tedium",
    description:
      "SoundCloud's native reordering is painfully slow for large playlists. Our batch operations and smart sorting let you reorganize hundreds of tracks in seconds.",
  },
  {
    title: "Lost Liked Tracks",
    description:
      "Your likes are a graveyard of forgotten discoveries. Convert them into organized playlists so you can actually listen to the music you've saved.",
  },
];

export default function Home() {
  return (
    <>
      <StructuredData faqs={faqs} />

      <div className="min-h-screen bg-[#F2F2F2] text-[#333333]">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-6">
          <div className="max-w-5xl mx-auto px-6 w-full">
            <div className="bg-white/90 backdrop-blur-sm rounded-full border border-gray-200 shadow-lg px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image
                  src="/sc toolkit transparent .png"
                  alt="SC Toolkit Logo"
                  width={120}
                  height={40}
                  className="h-8 sm:h-10 w-auto object-contain"
                  priority
                />
              </div>
              <div className="hidden md:flex items-center gap-8 text-sm absolute left-1/2 transform -translate-x-1/2">
                <a
                  href="#features"
                  className="hover:text-[#FF5500] transition"
                >
                  Features
                </a>
                <a
                  href="#who-its-for"
                  className="hover:text-[#FF5500] transition"
                >
                  Who It&apos;s For
                </a>
                <a
                  href="#how-it-works"
                  className="hover:text-[#FF5500] transition"
                >
                  How It Works
                </a>
                <a href="#faq" className="hover:text-[#FF5500] transition">
                  FAQ
                </a>
              </div>
              <div className="flex items-center">
                <Link
                  href="/login"
                  className="px-6 py-2 text-sm bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white rounded-full hover:shadow-lg transition-all font-semibold"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-40 pb-32 px-6 relative overflow-hidden bg-gradient-to-b from-[#FF5500]/5 to-transparent">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-[#333333]">
              Smarter SoundCloud Playlist Management
            </h1>
            <p className="text-lg md:text-xl text-[#666666] mb-10 max-w-2xl mx-auto leading-relaxed">
              SC Toolkit helps SoundCloud power users organize, merge, and clean
              playlists. Remove duplicates, manage thousands of tracks, and
              build better playlists faster than the native app allows.
            </p>
            <Link
              href="/login"
              className="inline-block px-10 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
            >
              Login with SoundCloud
            </Link>
            <p className="mt-4 text-sm text-[#999999]">
              Free to use. No credit card required.
            </p>
          </div>
        </section>

        {/* What SC Toolkit Does Section */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-[#333333]">
              What SC Toolkit Does
            </h2>
            <div className="prose prose-lg max-w-none text-[#666666] leading-relaxed">
              <p className="text-center text-lg mb-6">
                SC Toolkit is a free web application that extends SoundCloud
                with powerful playlist management features. While SoundCloud is
                great for discovering and streaming music, its native playlist
                tools are limited—especially for users with large libraries.
              </p>
              <p className="text-center text-lg">
                We connect securely to your SoundCloud account using official
                OAuth authentication, giving you the ability to merge playlists,
                remove duplicates, convert likes to playlists, and reorganize
                your music collection in ways that would take hours to do
                manually.
              </p>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section id="features" className="py-24 px-6 bg-[#F2F2F2]">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]">
              Key Features
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {features.map((feature, i) => (
                <article
                  key={i}
                  className="group bg-white border-2 border-gray-200 rounded-2xl p-10 hover:border-[#FF5500] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white text-4xl mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-[#333333] group-hover:text-[#FF5500] transition">
                    {feature.title}
                  </h3>
                  <p className="text-[#666666] leading-relaxed text-lg">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Why SC Toolkit Is Better Section */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-[#333333]">
              Why SC Toolkit Is Better Than the SoundCloud App
            </h2>
            <p className="text-center text-lg text-[#666666] mb-16 max-w-3xl mx-auto">
              SoundCloud&apos;s native app is designed for listening, not
              library management. Here&apos;s what SC Toolkit offers that
              SoundCloud doesn&apos;t:
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 bg-[#F2F2F2] p-6 rounded-xl border border-gray-200"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF5500] flex items-center justify-center text-white font-bold text-sm mt-1">
                    ✓
                  </div>
                  <p className="text-[#666666] text-lg leading-relaxed">
                    {benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Common Problems We Solve Section */}
        <section className="py-24 px-6 bg-[#F2F2F2]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-[#333333]">
              Common Problems We Solve
            </h2>
            <p className="text-center text-lg text-[#666666] mb-16 max-w-3xl mx-auto">
              If you&apos;ve been using SoundCloud for years, you probably
              recognize these frustrations. SC Toolkit was built specifically to
              solve them.
            </p>
            <div className="grid md:grid-cols-2 gap-8">
              {problems.map((problem, i) => (
                <article
                  key={i}
                  className="bg-white p-8 rounded-2xl border border-gray-200"
                >
                  <h3 className="text-xl font-bold mb-3 text-[#333333]">
                    {problem.title}
                  </h3>
                  <p className="text-[#666666] leading-relaxed">
                    {problem.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Who This Tool Is For Section */}
        <section id="who-its-for" className="py-24 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-[#333333]">
              Who This Tool Is For
            </h2>
            <p className="text-center text-lg text-[#666666] mb-16 max-w-3xl mx-auto">
              SC Toolkit is designed for SoundCloud power users who take their
              music organization seriously. Whether you&apos;re a professional
              or just passionate about music, these tools will transform how you
              manage your library.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {userTypes.map((user, i) => (
                <article
                  key={i}
                  className="bg-[#F2F2F2] p-6 rounded-2xl border border-gray-200 text-center"
                >
                  <h3 className="text-lg font-bold mb-3 text-[#333333]">
                    {user.title}
                  </h3>
                  <p className="text-[#666666] text-sm leading-relaxed">
                    {user.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 px-6 bg-[#F2F2F2]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-20 text-[#333333]">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  icon: "🔐",
                  title: "Connect",
                  description:
                    "Sign in securely with your SoundCloud account using official OAuth authentication. We never see your password.",
                },
                {
                  step: "2",
                  icon: "⚙️",
                  title: "Organize",
                  description:
                    "Use our powerful tools to merge playlists, sort tracks, remove duplicates, and convert your likes into playlists.",
                },
                {
                  step: "3",
                  icon: "🎵",
                  title: "Enjoy",
                  description:
                    "Your organized playlists sync directly back to SoundCloud. Enjoy your perfectly curated music library.",
                },
              ].map((item, i) => (
                <article key={i} className="relative text-center">
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF5500] text-white font-bold text-2xl mb-4">
                      {item.step}
                    </div>
                  </div>
                  <div className="text-6xl mb-4">{item.icon}</div>
                  <h3 className="text-2xl font-bold mb-3 text-[#333333]">
                    {item.title}
                  </h3>
                  <p className="text-[#666666] text-lg leading-relaxed">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Security & Privacy Section */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#F2F2F2] rounded-3xl p-12 text-center border-2 border-gray-200">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white text-4xl mx-auto mb-6">
                🛡️
              </div>
              <h2 className="text-3xl font-bold mb-4 text-[#333333]">
                Security & Privacy
              </h2>
              <p className="text-[#666666] text-lg leading-relaxed mb-6">
                SC Toolkit uses official SoundCloud OAuth authentication with
                PKCE. We never store your password and only request the minimum
                permissions needed. All access tokens are encrypted at rest
                using AES-256-GCM encryption. Your data stays private and
                secure.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-[#666666] mb-6">
                <span className="bg-white px-4 py-2 rounded-full border border-gray-200">
                  🔒 OAuth 2.0 + PKCE
                </span>
                <span className="bg-white px-4 py-2 rounded-full border border-gray-200">
                  🔐 AES-256-GCM Encryption
                </span>
                <span className="bg-white px-4 py-2 rounded-full border border-gray-200">
                  ✓ No Password Storage
                </span>
              </div>
              <Link
                href="/privacy"
                className="text-[#FF5500] hover:text-[#E64A00] font-semibold"
              >
                View Privacy Policy →
              </Link>
            </div>
          </div>
        </section>

        {/* Technical Capabilities Section */}
        <section className="py-24 px-6 bg-[#F2F2F2]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-[#333333]">
              Technical Capabilities
            </h2>
            <p className="text-center text-lg text-[#666666] mb-12 max-w-3xl mx-auto">
              Built with modern web technologies for speed, security, and
              reliability.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <article className="bg-white p-6 rounded-xl border border-gray-200 text-center">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="font-bold text-[#333333] mb-2">
                  Batch Operations
                </h3>
                <p className="text-[#666666] text-sm">
                  Process hundreds of tracks at once. Merge, sort, and dedupe
                  entire playlists in seconds.
                </p>
              </article>
              <article className="bg-white p-6 rounded-xl border border-gray-200 text-center">
                <div className="text-4xl mb-4">🔄</div>
                <h3 className="font-bold text-[#333333] mb-2">
                  Respectful API Usage
                </h3>
                <p className="text-[#666666] text-sm">
                  We follow SoundCloud&apos;s API guidelines and rate limits.
                  Your account stays safe.
                </p>
              </article>
              <article className="bg-white p-6 rounded-xl border border-gray-200 text-center">
                <div className="text-4xl mb-4">🌐</div>
                <h3 className="font-bold text-[#333333] mb-2">
                  Works Everywhere
                </h3>
                <p className="text-[#666666] text-sm">
                  Web-based tool that works on any device with a modern browser.
                  No downloads required.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details
                  key={index}
                  className="bg-[#F2F2F2] rounded-xl border-2 border-gray-200 overflow-hidden group"
                >
                  <summary className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-100 transition-colors cursor-pointer list-none">
                    <h3 className="text-lg md:text-xl font-semibold text-[#333333] pr-4">
                      {faq.question}
                    </h3>
                    <span className="text-[#FF5500] text-2xl flex-shrink-0 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <div className="px-6 pb-5 pt-0">
                    <p className="text-[#666666] text-base md:text-lg leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-24 px-6 bg-gradient-to-b from-[#FF5500]/10 to-[#F2F2F2]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[#333333]">
              Ready to Organize Your SoundCloud?
            </h2>
            <p className="text-lg text-[#666666] mb-10 max-w-2xl mx-auto">
              Join thousands of SoundCloud power users who have transformed
              their music libraries with SC Toolkit. It&apos;s free, secure, and
              takes just seconds to get started.
            </p>
            <Link
              href="/login"
              className="inline-block px-12 py-5 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-xl"
            >
              Get Started Free →
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-300 py-12 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-4 text-[#666666]">
                <Link href="/about" className="hover:text-[#FF5500] transition">
                  About
                </Link>
                <span>•</span>
                <Link
                  href="/privacy"
                  className="hover:text-[#FF5500] transition"
                >
                  Privacy Policy
                </Link>
              </div>
              <p className="text-sm text-[#999999] mb-2">
                SC Toolkit is not affiliated with SoundCloud.
              </p>
              <p className="text-sm text-[#999999]">
                © {new Date().getFullYear()} SC Toolkit. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
