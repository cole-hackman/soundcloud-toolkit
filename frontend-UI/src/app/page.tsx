export default function Home() {
  return (
    <div className="min-h-screen bg-[#F2F2F2] text-[#333333]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-2">
              <div className="text-xl font-bold text-[#FF5500]">SC Toolkit</div>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm">
              <a href="#features" className="hover:text-[#FF5500] transition">Features</a>
              <a href="#benefits" className="hover:text-[#FF5500] transition">Benefits</a>
              <a href="#how-it-works" className="hover:text-[#FF5500] transition">How It Works</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-6 py-2 text-sm bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white rounded-lg hover:shadow-lg transition-all font-semibold">
              Continue with SoundCloud
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-32 px-6 relative overflow-hidden bg-gradient-to-b from-[#FF5500]/5 to-transparent">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight text-[#333333]">
            Smarter SoundCloud
            <br />
            <span className="bg-gradient-to-r from-[#FF5500] to-[#E64A00] bg-clip-text text-transparent">
              Playlists
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[#666666] mb-10 max-w-2xl mx-auto leading-relaxed">
            Organize, merge, and clean your SoundCloud music in ways the native app can't. Powerful tools for power users.
          </p>
          <button className="px-10 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg">
            Continue with SoundCloud →
          </button>
          <p className="mt-4 text-sm text-[#666666]">
            <a href="#how-it-works" className="hover:text-[#FF5500] transition">Learn More</a>
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]">
            Powerful Features
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: "⊞",
                title: "Combine Playlists",
                description: "Merge multiple playlists into one unified collection. Automatically detect and remove duplicate tracks across all sources. Perfect for consolidating your music library or creating mega-playlists."
              },
              {
                icon: "♥",
                title: "Likes → Playlist",
                description: "Transform your liked tracks into organized playlists. Select from thousands of favorites and batch-create playlists with custom names. Never lose track of your favorite discoveries again."
              },
              {
                icon: "⇅",
                title: "Playlist Modifier",
                description: "Take full control of your playlists. Reorder tracks with drag-and-drop, remove unwanted songs, and apply smart sorting by title, artist, date, duration, or BPM. Your playlists, your way."
              },
              {
                icon: "🔗",
                title: "Link Resolver",
                description: "Get instant metadata from any SoundCloud URL. Resolve tracks, playlists, and user profiles to extract detailed information. Perfect for research, organization, and discovery."
              }
            ].map((feature, i) => (
              <div key={i} className="group bg-white border-2 border-gray-200 rounded-2xl p-10 hover:border-[#FF5500] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white text-4xl mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#333333] group-hover:text-[#FF5500] transition">
                  {feature.title}
                </h3>
                <p className="text-[#666666] leading-relaxed text-lg">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]">
            Built for SoundCloud Power Users
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              "Organize thousands of tracks with advanced playlist management tools",
              "Automatically detect and remove duplicate tracks across playlists",
              "Batch edit and reorganize your entire music library efficiently",
              "Get insights and analytics from SoundCloud links and metadata",
              "Smart sorting algorithms (by BPM, duration, artist, date)",
              "No limits - handle playlists with hundreds of tracks"
            ].map((benefit, i) => (
              <div key={i} className="flex items-start gap-4 bg-white p-6 rounded-xl border border-gray-200">
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

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
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
                description: "Sign in securely with your SoundCloud account using OAuth"
              },
              {
                step: "2",
                icon: "⚙️",
                title: "Organize",
                description: "Use powerful tools to merge, sort, and clean your playlists"
              },
              {
                step: "3",
                icon: "🎵",
                title: "Enjoy",
                description: "Export your organized playlists back to SoundCloud"
              }
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF5500] text-white font-bold text-2xl mb-4">
                    {item.step}
                  </div>
                </div>
                <div className="text-6xl mb-4">{item.icon}</div>
                <h3 className="text-2xl font-bold mb-3 text-[#333333]">{item.title}</h3>
                <p className="text-[#666666] text-lg leading-relaxed">
                  {item.description}
                </p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 right-0 w-full h-0.5 bg-gradient-to-r from-[#FF5500] to-transparent transform translate-x-1/2"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-gray-200 shadow-xl">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white text-4xl mx-auto mb-6">
              🛡️
            </div>
            <h2 className="text-3xl font-bold mb-4 text-[#333333]">Secure & Private</h2>
            <p className="text-[#666666] text-lg leading-relaxed mb-6">
              SC Toolkit uses official SoundCloud OAuth authentication. We never store your password and only request the minimum permissions needed. Your data stays private and secure.
            </p>
            <a href="/privacy" className="text-[#FF5500] hover:text-[#E64A00] font-semibold">
              View Privacy Policy →
            </a>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: "500+", label: "Tracks per playlist" },
              { number: "Zero", label: "Duplicates" },
              { number: "100%", label: "Secure" },
              { number: "Free", label: "To use" }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl md:text-6xl font-bold text-[#FF5500] mb-2">
                  {stat.number}
                </div>
                <div className="text-[#666666] text-lg">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-300 py-12 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4 text-[#666666]">
              <a href="/about" className="hover:text-[#FF5500] transition">About</a>
              <span>•</span>
              <a href="/privacy" className="hover:text-[#FF5500] transition">Privacy Policy</a>
            </div>
            <p className="text-sm text-[#999999] mb-2">
              SC Toolkit is not affiliated with SoundCloud.
            </p>
            <p className="text-sm text-[#999999]">
              © 2025 SC Toolkit. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating CTA */}
      <div className="fixed bottom-8 right-8 z-50 hidden md:block">
        <button className="px-6 py-3 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg shadow-2xl hover:shadow-orange-500/50 transition-all">
          Get Started
        </button>
      </div>
    </div>
  );
}
