import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers, Heart, ArrowUpDown, Link as LinkIcon, Shield, LogIn, Settings,
  Music, Check, ChevronDown, Radio, UserMinus, ThumbsDown, Download,
  Link2, HeartPulse, Zap, Lock, Palette
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StructuredData from '../components/StructuredData';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import scLogo from '/sc toolkit transparent .png';

function Home() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  // Handle smooth scrolling for anchor links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const id = href.substring(1);
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  const handleCTAClick = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors duration-200" style={{ background: 'var(--sc-light-gray)' }}>
        <div className="w-8 h-8 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    {
      icon: Layers,
      title: 'Combine Playlists',
      description: 'Merge multiple playlists into one unified collection. Automatically detect and remove duplicate tracks across all sources. Perfect for consolidating your music library.'
    },
    {
      icon: Heart,
      title: 'Likes → Playlist',
      description: 'Transform your liked tracks into organized playlists. Select from thousands of favorites and batch-create playlists with custom names.'
    },
    {
      icon: ArrowUpDown,
      title: 'Playlist Modifier',
      description: 'Take full control of your playlists. Reorder tracks with drag-and-drop, remove unwanted songs, and apply smart sorting by title, artist, date, duration, or BPM.'
    },
    {
      icon: Radio,
      title: 'Activity to Playlist',
      description: 'Turn your SoundCloud activity feed into a curated playlist. Capture recently posted tracks from artists you follow before they get buried.'
    },
    {
      icon: UserMinus,
      title: 'Following Manager',
      description: 'See who doesn\'t follow you back, clean up your following list, and bulk unfollow accounts. Take control of your SoundCloud social graph.'
    },
    {
      icon: ThumbsDown,
      title: 'Like Manager',
      description: 'Browse, search, and bulk unlike tracks to keep your liked collection focused. Clean up thousands of stale likes in seconds.'
    },
    {
      icon: Download,
      title: 'Downloads',
      description: 'Download tracks directly where the artist has enabled downloads or provided a purchase link. No third-party downloaders needed.'
    },
    {
      icon: Link2,
      title: 'Batch Link Resolver',
      description: 'Paste multiple SoundCloud URLs and resolve them all at once. Get instant metadata for tracks, playlists, and users in bulk.'
    },
    {
      icon: HeartPulse,
      title: 'Playlist Health Check',
      description: 'Scan your playlists for blocked, deleted, or unstreamable tracks and clean them up. Keep your playlists in perfect shape.'
    },
    {
      icon: LinkIcon,
      title: 'Link Resolver',
      description: 'Get instant metadata from any SoundCloud URL. Resolve tracks, playlists, and user profiles to extract detailed information.'
    }
  ];

  const benefits = [
    'Merge multiple playlists with automatic duplicate removal',
    'Turn liked tracks or activity feed into organized playlists',
    'Download tracks with available download or purchase links',
    'Manage your following list — find who doesn\'t follow back',
    'Bulk operations: unlike tracks, unfollow users, resolve links',
    'Smart playlist health checks for blocked or deleted tracks',
    'Dark and light theme to match your preference',
    '100% free with secure OAuth — your password is never stored'
  ];

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

  const faqs = [
    {
      question: 'Is SC Toolkit free to use?',
      answer: 'Yes, SC Toolkit is completely free to use. We provide powerful playlist management and social tools at no cost to help you organize your SoundCloud music.'
    },
    {
      question: 'Do I need a SoundCloud Go+ or Pro subscription?',
      answer: 'No! SC Toolkit works with all SoundCloud accounts, including free ones. You do not need a paid subscription to use any of our features.'
    },
    {
      question: 'How secure is my SoundCloud account?',
      answer: 'Your account security is our top priority. We use official SoundCloud OAuth authentication, which means we never see or store your password. We only request the minimum permissions needed to manage your playlists, and all tokens are encrypted at rest with AES-256-GCM.'
    },
    {
      question: 'Can I merge playlists with more than 500 tracks?',
      answer: 'Yes! When merging playlists that exceed 500 tracks, SC Toolkit automatically splits them into multiple playlists (e.g., Part 1/3, Part 2/3, Part 3/3) so you don\'t lose a single track.'
    },
    {
      question: 'What happens to my original playlists?',
      answer: 'Your original playlists remain completely untouched. When you merge playlists or create new ones from your likes, we create new playlists rather than modifying existing ones. You have full control over your music library.'
    },
    {
      question: 'Can I see who doesn\'t follow me back?',
      answer: 'Yes! The Following Manager compares your followers and following lists to show who doesn\'t follow you back. You can then bulk unfollow to clean up your social graph.'
    },
    {
      question: 'Can I download tracks from SoundCloud?',
      answer: 'SC Toolkit helps you download tracks where the artist has enabled downloads or provided a purchase link. We respect artist preferences and never bypass download restrictions.'
    },
    {
      question: 'What is Activity to Playlist?',
      answer: 'Activity to Playlist pulls the latest tracks from your SoundCloud activity feed — songs recently posted by artists you follow — and lets you save them as a new playlist before they get buried in your feed.'
    },
    {
      question: 'Does SC Toolkit work with private playlists?',
      answer: 'Yes, SC Toolkit works with both public and private playlists. As long as you have access to the playlists through your SoundCloud account, you can use all our tools to organize them.'
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const socialProofStats = [
    { icon: Zap, label: '10+ Tools', description: 'Powerful features' },
    { icon: Lock, label: 'Secure', description: 'OAuth & encrypted' },
    { icon: Heart, label: '100% Free', description: 'No hidden costs' },
    { icon: Palette, label: 'Dark Mode', description: 'Light & dark themes' }
  ];

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}>
      {/* Structured Data for SEO */}
      <StructuredData faqs={faqs} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4 sm:pt-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full">
          <div className="backdrop-blur-sm rounded-full border shadow-lg px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between transition-colors duration-200" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-text-light)' }}>
            <div className="flex items-center gap-2">
              <img src={scLogo} alt="SC Toolkit" className="h-8 sm:h-10 object-contain" />
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm absolute left-1/2 transform -translate-x-1/2">
              <a href="#features" className="hover:text-[#FF5500] transition">Features</a>
              <a href="#benefits" className="hover:text-[#FF5500] transition">Benefits</a>
              <a href="#how-it-works" className="hover:text-[#FF5500] transition">How It Works</a>
              <a href="#faq" className="hover:text-[#FF5500] transition">FAQ</a>
            </div>
            <div className="flex items-center">
              <button 
                onClick={handleCTAClick}
                className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white rounded-full hover:shadow-lg transition-all font-semibold"
              >
                {isAuthenticated ? 'Dashboard' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 md:pt-40 pb-16 sm:pb-24 md:pb-32 px-4 sm:px-6 relative overflow-hidden bg-gradient-to-b from-[#FF5500]/5 to-transparent">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 sm:mb-6 leading-tight"
            style={{ color: 'var(--sc-text-dark)' }}
          >
            The Ultimate SoundCloud
            <br />
            <span className="bg-gradient-to-r from-[#FF5500] to-[#E64A00] bg-clip-text text-transparent">
              Toolkit
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4"
            style={{ color: 'var(--sc-text-light)' }}
          >
            Organize playlists, manage followers, download tracks, and clean up your SoundCloud in ways the native app can't. Free for all users.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button 
              onClick={handleCTAClick}
              className="px-10 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
            >
              {isAuthenticated ? 'Go to Dashboard →' : 'Get Started Free →'}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Ribbon */}
      <section className="py-8 px-6 border-y" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {socialProofStats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex items-center gap-3 justify-center"
              >
                <div className="w-10 h-10 rounded-lg bg-[#FF5500]/10 flex items-center justify-center flex-shrink-0">
                  <stat.icon className="w-5 h-5 text-[#FF5500]" />
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--sc-text-dark)' }}>{stat.label}</div>
                  <div className="text-xs" style={{ color: 'var(--sc-text-light)' }}>{stat.description}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 transition-colors duration-200" style={{ background: 'var(--sc-white)' }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--sc-text-dark)' }}>
              Powerful Features
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--sc-text-light)' }}>
              Everything you need to take control of your SoundCloud experience
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="group border-2 rounded-2xl p-8 hover:border-[#FF5500] hover:shadow-2xl transition-all duration-300"
                style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white mb-5">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-[#FF5500] transition" style={{ color: 'var(--sc-text-dark)' }}>
                  {feature.title}
                </h3>
                <p className="leading-relaxed" style={{ color: 'var(--sc-text-light)' }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-center mb-16"
            style={{ color: 'var(--sc-text-dark)' }}
          >
            Built for SoundCloud Power Users
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-start gap-4 p-6 rounded-xl border"
                style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF5500] flex items-center justify-center text-white font-bold text-sm mt-1">
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-lg leading-relaxed" style={{ color: 'var(--sc-text-light)' }}>
                  {benefit}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 transition-colors duration-200" style={{ background: 'var(--sc-white)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-center mb-20"
            style={{ color: 'var(--sc-text-dark)' }}
          >
            How It Works
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white">
                    <item.icon className="w-8 h-8" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--sc-text-dark)' }}>{item.title}</h3>
                <p className="text-lg leading-relaxed" style={{ color: 'var(--sc-text-light)' }}>
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-center mb-16"
            style={{ color: 'var(--sc-text-dark)' }}
          >
            Frequently Asked Questions
          </motion.h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="rounded-xl border-2 overflow-hidden hover:border-[#FF5500] transition-all duration-300"
                style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-black/5 transition-colors"
                >
                  <h3 className="text-lg md:text-xl font-semibold pr-4" style={{ color: 'var(--sc-text-dark)' }}>
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-[#FF5500] flex-shrink-0 transition-transform duration-300 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {openFAQ === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-0">
                        <p className="text-base md:text-lg leading-relaxed" style={{ color: 'var(--sc-text-light)' }}>
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="pt-12 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl p-12 text-center border-2 shadow-xl"
            style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white mx-auto mb-6">
              <Shield className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--sc-text-dark)' }}>Secure & Private</h2>
            <p className="text-lg leading-relaxed mb-6" style={{ color: 'var(--sc-text-light)' }}>
              SC Toolkit uses official SoundCloud OAuth authentication. We never store your password and only request the minimum permissions needed. All tokens are encrypted with AES-256-GCM. Your data stays private and secure.
            </p>
            <Link to="/privacy" className="text-[#FF5500] hover:text-[#E64A00] font-semibold">
              View Privacy Policy →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-b from-transparent to-[#FF5500]/5">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--sc-text-dark)' }}>
              Ready to level up your SoundCloud?
            </h2>
            <p className="text-lg mb-8" style={{ color: 'var(--sc-text-light)' }}>
              Join thousands of power users who manage their SoundCloud with SC Toolkit. It's free, secure, and takes 30 seconds to get started.
            </p>
            <button 
              onClick={handleCTAClick}
              className="px-10 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
            >
              {isAuthenticated ? 'Go to Dashboard →' : 'Get Started Free →'}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-6 transition-colors duration-200" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Link to="/about" className="text-[#FF5500] hover:text-[#E64A00] transition">About</Link>
              <span className="text-[#666666]">•</span>
              <Link to="/privacy" className="text-[#FF5500] hover:text-[#E64A00] transition">Privacy Policy</Link>
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
  );
}

export default Home;
