import React from 'react';
import { motion } from 'framer-motion';
import { Music, Play, Users, Zap, Layers, Heart, ListChecks, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import scLogo from '/sc toolkit transparent .png';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const { login } = useAuth();

  // Pre-warm API before redirecting to reduce cold-start hiccups
  const prewarmAndLogin = async () => {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';
    try {
      await Promise.race([
        fetch(`${API_BASE}/health`, { credentials: 'include' }),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
    } catch {}
    try {
      // one retry if it was asleep
      await Promise.race([
        fetch(`${API_BASE}/health`, { credentials: 'include' }),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
    } catch {}
    login();
  };

  const features = [
    { icon: Layers, title: 'Combine Playlists', desc: 'Merge and remove duplicates instantly.' },
    { icon: Heart, title: 'Likes → Playlist', desc: 'Turn favorites into organized collections.' },
    { icon: ListChecks, title: 'Smart Deduplication', desc: 'Keep your playlists clean.' },
    { icon: LinkIcon, title: 'Link Resolver', desc: 'Get details from any SoundCloud link.' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-200" style={{ background: 'var(--sc-light-gray)' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[480px]">
        <div className="sc-card p-8 relative">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6 mt-8">
            <img src={scLogo} alt="SC Toolkit" className="w-[140px] sm:w-[180px] object-contain" />
          </div>

          {/* Headline */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Smarter SoundCloud Playlists</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--sc-text-light)' }}>Organize, merge, and clean your SoundCloud music in ways the native app can’t.</p>
          </div>

          {/* Features */}
          <div className="space-y-4 mb-8">
            {features.map((f, index) => (
              <motion.div key={index} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: 0.15 + index * 0.07 }} className="flex items-start gap-3 py-3">
                <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'var(--sc-orange)' }}>
                  <f.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--sc-text-dark)' }}>{f.title}</div>
                  <div className="text-base" style={{ color: 'var(--sc-text-light)' }}>{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Login Button (hidden on mobile; mobile has sticky CTA below) */}
          <div className="hidden sm:flex justify-center">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={prewarmAndLogin} className="w-full sm:w-[280px] sc-primary-button mx-auto flex items-center justify-center rounded bg-gradient-to-r from-[#FF5500] to-[#E64A00] hover:brightness-95 hover:shadow-orange-200 text-white py-3">
              <span className="whitespace-nowrap">Continue with SoundCloud</span>
            </motion.button>
          </div>
          <p className="text-xs text-center mt-3" style={{ color: 'var(--sc-text-light)' }}>Secure authentication via SoundCloud.</p>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-4 mt-6 text-sm text-gray-500">
            <Link className="text-sm text-gray-500 hover:text-[#FF5500]" to="/about">About</Link>
            <Link className="text-sm text-gray-500 hover:text-[#FF5500]" to="/privacy">Privacy</Link>
          </div>
        </div>
      </motion.div>
      {/* Sticky mobile CTA */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 backdrop-blur border-t" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}>
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={prewarmAndLogin} className="w-full flex items-center justify-center rounded bg-gradient-to-r from-[#FF5500] to-[#E64A00] hover:brightness-95 hover:shadow-orange-200 text-white py-3">
          <span className="whitespace-nowrap">Continue with SoundCloud</span>
        </motion.button>
      </div>
    </div>
  );
}

export default Login;