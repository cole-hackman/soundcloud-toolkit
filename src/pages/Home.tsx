import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, Heart, ArrowUpDown, Link as LinkIcon, Shield, LogIn, Settings, Music, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F2]">
        <div className="w-8 h-8 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    {
      icon: Layers,
      title: 'Combine Playlists',
      description: 'Merge multiple playlists into one unified collection. Automatically detect and remove duplicate tracks across all sources. Perfect for consolidating your music library or creating mega-playlists.'
    },
    {
      icon: Heart,
      title: 'Likes → Playlist',
      description: 'Transform your liked tracks into organized playlists. Select from thousands of favorites and batch-create playlists with custom names. Never lose track of your favorite discoveries again.'
    },
    {
      icon: ArrowUpDown,
      title: 'Playlist Modifier',
      description: 'Take full control of your playlists. Reorder tracks with drag-and-drop, remove unwanted songs, and apply smart sorting by title, artist, date, duration, or BPM. Your playlists, your way.'
    },
    {
      icon: LinkIcon,
      title: 'Link Resolver',
      description: 'Get instant metadata from any SoundCloud URL. Resolve tracks, playlists, and user profiles to extract detailed information. Perfect for research, organization, and discovery.'
    }
  ];

  const benefits = [
    'Organize thousands of tracks with advanced playlist management tools',
    'Automatically detect and remove duplicate tracks across playlists',
    'Batch edit and reorganize your entire music library efficiently',
    'Get insights and analytics from SoundCloud links and metadata',
    'Smart sorting algorithms (by BPM, duration, artist, date)',
    'No limits - handle playlists with hundreds of tracks'
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
      description: 'Use powerful tools to merge, sort, and clean your playlists'
    },
    {
      step: '3',
      icon: Music,
      title: 'Enjoy',
      description: 'Export your organized playlists back to SoundCloud'
    }
  ];

  const faqs = [
    {
      question: 'Is SC Toolkit free to use?',
      answer: 'Yes, SC Toolkit is completely free to use. We provide powerful playlist management tools at no cost to help you organize your SoundCloud music.'
    },
    {
      question: 'How secure is my SoundCloud account?',
      answer: 'Your account security is our top priority. We use official SoundCloud OAuth authentication, which means we never see or store your password. We only request the minimum permissions needed to manage your playlists, and all tokens are encrypted at rest.'
    },
    {
      question: 'Can I merge playlists with more than 500 tracks?',
      answer: 'SoundCloud has a limit of 500 tracks per playlist. When merging playlists, we automatically cap the result at 500 tracks and remove duplicates to ensure your merged playlist is valid. If you have more tracks, we\'ll include the first 500 unique tracks.'
    },
    {
      question: 'What happens to my original playlists?',
      answer: 'Your original playlists remain completely untouched. When you merge playlists or create new ones from your likes, we create new playlists rather than modifying existing ones. You have full control over your music library.'
    },
    {
      question: 'Can I undo changes made to my playlists?',
      answer: 'When using the Playlist Modifier, you can undo the last applied order. However, we recommend being careful with playlist modifications as SoundCloud doesn\'t provide a built-in undo feature. Always review changes before saving.'
    },
    {
      question: 'Does SC Toolkit work with private playlists?',
      answer: 'Yes, SC Toolkit works with both public and private playlists. As long as you have access to the playlists through your SoundCloud account, you can use all our tools to organize them.'
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] text-[#333333]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4 sm:pt-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full">
          <div className="bg-white/90 backdrop-blur-sm rounded-full border border-gray-200 shadow-lg px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
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
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 sm:mb-6 leading-tight text-[#333333]"
          >
            Smarter SoundCloud
            <br />
            <span className="bg-gradient-to-r from-[#FF5500] to-[#E64A00] bg-clip-text text-transparent">
              Playlists
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg md:text-xl text-[#666666] mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4"
          >
            Organize, merge, and clean your SoundCloud music in ways the native app can't. Powerful tools for power users.
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
              {isAuthenticated ? 'Go to Dashboard →' : 'Login with SoundCloud'}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]"
          >
            Powerful Features
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="group bg-white border-2 border-gray-200 rounded-2xl p-10 hover:border-[#FF5500] hover:shadow-2xl transition-all duration-300"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white mb-6">
                  <feature.icon className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#333333] group-hover:text-[#FF5500] transition">
                  {feature.title}
                </h3>
                <p className="text-[#666666] leading-relaxed text-lg">
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
            className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]"
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
                className="flex items-start gap-4 bg-white p-6 rounded-xl border border-gray-200"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF5500] flex items-center justify-center text-white font-bold text-sm mt-1">
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-[#666666] text-lg leading-relaxed">
                  {benefit}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-center mb-20 text-[#333333]"
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
                <h3 className="text-2xl font-bold mb-3 text-[#333333]">{item.title}</h3>
                <p className="text-[#666666] text-lg leading-relaxed">
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
            className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#333333]"
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
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-[#FF5500] transition-all duration-300"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg md:text-xl font-semibold text-[#333333] pr-4">
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
                        <p className="text-[#666666] text-base md:text-lg leading-relaxed">
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
            className="bg-white rounded-3xl p-12 text-center border-2 border-gray-200 shadow-xl"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white mx-auto mb-6">
              <Shield className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold mb-4 text-[#333333]">Secure & Private</h2>
            <p className="text-[#666666] text-lg leading-relaxed mb-6">
              SC Toolkit uses official SoundCloud OAuth authentication. We never store your password and only request the minimum permissions needed. Your data stays private and secure.
            </p>
            <Link to="/privacy" className="text-[#FF5500] hover:text-[#E64A00] font-semibold">
              View Privacy Policy →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-300 py-12 px-6 bg-white">
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

