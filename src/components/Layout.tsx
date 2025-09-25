import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Home } from 'lucide-react';
// Bundle logos so preview serves hashed assets reliably
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import logoUrl from '/sc toolkit transparent .png';
import { useAuth } from '../contexts/AuthContext';
import ToastHost from './ToastHost';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--sc-light-gray)' }}>
      {/* Header */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky top-0 z-50" style={{ background: 'var(--sc-white)', borderBottom: '1px solid var(--sc-light-gray)' }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <picture>
                {/* If a WebP is added later at the same path, modern browsers will use it automatically */}
                <source srcSet={String(logoUrl).replace('.png', '.webp')} type="image/webp" />
                <img src={logoUrl} alt="SoundCloud Tools" className="h-10 w-auto object-contain" loading="lazy" decoding="async" />
              </picture>
            </Link>

            <div className="flex items-center space-x-4 relative">
              <Link to="/dashboard" className="p-2 rounded sc-focus" style={{ color: 'var(--sc-text-light)' }}>
                <Home className="w-5 h-5" />
              </Link>
              {user && <ProfileMenu user={{ name: user.display_name, avatar: user.avatar_url }} onLogout={logout} />}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1">
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
          {children}
        </motion.div>
      </main>
      <ToastHost />
    </div>
  );
}

export default Layout;

function ProfileMenu({ user, onLogout }: { user: { name: string; avatar: string }; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 p-1 rounded sc-focus">
        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" loading="lazy" decoding="async" style={{ border: '2px solid var(--sc-orange)' }} />
        <span className="text-sm hidden sm:block" style={{ color: 'var(--sc-text-light)' }}>{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 sc-card p-1" style={{ background: 'var(--sc-white)' }}>
          <button disabled className="w-full text-left px-3 py-2 rounded opacity-60 cursor-not-allowed" style={{ color: 'var(--sc-text-light)' }}>Profile</button>
          <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded sc-focus sc-hover-card" style={{ color: 'var(--sc-text-dark)' }}>Logout</button>
        </div>
      )}
    </div>
  );
}