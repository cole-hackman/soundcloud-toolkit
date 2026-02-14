import Image from "next/image";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";
import { 
  Layers, Heart, ArrowUpDown, Check, Lock, Zap, RefreshCw, Globe, Shield, 
  Radio, UserMinus, ThumbsDown, Download, HeartPulse, Link as LinkIcon, Music, Settings, LogIn 
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
    step: '1',
    icon: LogIn,
    title: 'Connect',
    description: 'Sign in securely with your SoundCloud account using OAuth'
  },
  {
    step: '2',
    icon: Settings,
    title: 'Organize',
    description: 'Use 10+ powerful tools to merge, sort, clean, and manage your library'
  },
  {
    step: '3',
    icon: Music,
    title: 'Enjoy',
    description: 'Export your organized playlists back to SoundCloud instantly'
  }
];

export default function Home() {
  return (
    <>
      <StructuredData faqs={faqs} />

      <div className="min-h-screen bg-[#F2F2F2] text-[#333333]">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4 sm:pt-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full">
            <div className="bg-white/90 backdrop-blur-sm rounded-full border border-gray-200 shadow-lg px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image
                  src="/sc toolkit transparent .png"
                  alt="SC Toolkit Logo"
                  width={120}
                  height={40}
                  className="h-8 sm:h-10 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>
              <div className="hidden md:flex items-center gap-8 text-sm absolute left-1/2 transform -translate-x-1/2">
                <a href="#features" className="hover:text-[#FF5500] transition">Features</a>
                <a href="#benefits" className="hover:text-[#FF5500] transition">Benefits</a>
                <a href="#how-it-works" className="hover:text-[#FF5500] transition">How It Works</a>
                <a href="#faq" className="hover:text-[#FF5500] transition">FAQ</a>
              </div>
              <div className="flex items-center">
                <Link
                  href="/login"
                  className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white rounded-full hover:shadow-lg transition-all font-semibold"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-24 sm:pt-32 md:pt-40 pb-16 sm:pb-24 md:pb-32 px-4 sm:px-6 relative overflow-hidden bg-gradient-to-b from-[#FF5500]/5 to-transparent">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight text-[#333333]">
              The Ultimate SoundCloud <br />
              <span className="bg-gradient-to-r from-[#FF5500] to-[#E64A00] bg-clip-text text-transparent">
                Toolkit
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#666666] mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4">
              Organize playlists, manage followers, download tracks, and clean up your SoundCloud in ways the native app can't. Free for all users.
            </p>
            <Link
              href="/login"
              className="inline-block px-10 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
            >
              Get Started Free →
            </Link>
            <p className="mt-4 text-xs sm:text-sm text-[#999999]">
              Free to use. No credit card required.
            </p>
          </div>
        </section>

        {/* Social Proof Ribbon - NEW */}
        <section className="py-8 px-6 border-y bg-white border-gray-200">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Zap, label: '10+ Tools', description: 'Powerful features' },
                { icon: Lock, label: 'Secure', description: 'OAuth & encrypted' },
                { icon: Heart, label: '100% Free', description: 'No hidden costs' },
                { icon: Layers, label: 'Unlimited', description: 'Playlist management' }
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-3 justify-center">
                  <div className="w-10 h-10 rounded-lg bg-[#FF5500]/10 flex items-center justify-center flex-shrink-0">
                    <stat.icon className="w-5 h-5 text-[#FF5500]" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#333333]">{stat.label}</div>
                    <div className="text-xs text-[#666666]">{stat.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section - UPDATED */}
        <section id="features" className="py-24 px-6 bg-[#F2F2F2]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333]">
                Powerful Features
              </h2>
              <p className="text-lg max-w-2xl mx-auto text-[#666666]">
                Everything you need to take control of your SoundCloud experience
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, i) => {
                const IconComponent = feature.icon;
                return (
                  <div
                    key={i}
                    className="group bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-[#FF5500] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white mb-5">
                      <IconComponent className="w-7 h-7" strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-[#333333] group-hover:text-[#FF5500] transition">
                      {feature.title}
                    </h3>
                    <p className="text-[#666666] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Benefits Section - UPDATED */}
        <section id="benefits" className="py-24 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]">
              Built for SoundCloud Power Users
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 bg-[#F2F2F2] p-6 rounded-xl border border-gray-200"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF5500] flex items-center justify-center text-white font-bold text-sm mt-1">
                    <Check className="w-4 h-4" />
                  </div>
                  <p className="text-[#666666] text-lg leading-relaxed">
                    {benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who This Tool Is For Section */}
        <section id="who-its-for" className="py-24 px-6 bg-[#F2F2F2]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-[#333333]">
              Who This Tool Is For
            </h2>
            <p className="text-center text-lg text-[#666666] mb-16 max-w-3xl mx-auto">
              SC Toolkit is designed for SoundCloud power users who take their
              music organization seriously.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {userTypes.map((user, i) => (
                <div
                  key={i}
                  className="bg-white p-6 rounded-2xl border border-gray-200 text-center"
                >
                  <h3 className="text-lg font-bold mb-3 text-[#333333]">
                    {user.title}
                  </h3>
                  <p className="text-[#666666] text-sm leading-relaxed">
                    {user.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section - UPDATED */}
        <section id="how-it-works" className="py-24 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-20 text-[#333333]">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((item, i) => {
                const IconComponent = item.icon;
                return (
                  <div key={i} className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white">
                        <IconComponent className="w-8 h-8" strokeWidth={2} />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-[#333333]">
                      {item.title}
                    </h3>
                    <p className="text-[#666666] text-lg leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Security & Privacy Section */}
        <section className="py-24 px-6 bg-[#F2F2F2]">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl p-12 text-center border-2 border-gray-200 shadow-xl">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white mx-auto mb-6">
                <Shield className="w-10 h-10" strokeWidth={2} />
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
                <span className="bg-[#F2F2F2] px-4 py-2 rounded-full border border-gray-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#FF5500]" /> OAuth 2.0 + PKCE
                </span>
                <span className="bg-[#F2F2F2] px-4 py-2 rounded-full border border-gray-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#FF5500]" /> AES-256-GCM Encryption
                </span>
                <span className="bg-[#F2F2F2] px-4 py-2 rounded-full border border-gray-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#FF5500]" /> No Password Storage
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

        {/* FAQ Section - UPDATED */}
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
