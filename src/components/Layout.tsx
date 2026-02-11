import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Home, Moon, Sun } from 'lucide-react';
// Bundle logos so preview serves hashed assets reliably
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import logoPng from '/sc toolkit transparent .png';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import logoWebp from '/sc toolkit transparent.webp';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ToastHost from './ToastHost';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}>
      {/* Header */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky top-0 z-50" style={{ background: 'var(--sc-white)', borderBottom: '1px solid var(--sc-light-gray)' }}>
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="h-8 sm:h-10 md:h-12 overflow-hidden flex items-center">
                <picture>
                  <source srcSet={logoWebp} type="image/webp" />
                  <img src={logoPng} alt="SoundCloud Tools" className="h-full w-auto object-contain" loading="lazy" decoding="async" />
                </picture>
              </div>
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
  const { theme, toggleTheme } = useTheme();
  
  // Close menu when clicking outside
  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.profile-menu-container')) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);
  
  return (
    <div className="relative profile-menu-container">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 p-1 rounded sc-focus">
        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" loading="lazy" decoding="async" style={{ border: '2px solid var(--sc-orange)' }} />
        <span className="text-sm hidden sm:block" style={{ color: 'var(--sc-text-light)' }}>{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 sc-card p-1 shadow-lg z-50" style={{ background: 'var(--sc-white)', border: '1px solid var(--sc-light-gray)' }}>
          <button 
            onClick={(e) => {
              console.log('ProfileMenu: Toggle button clicked');
              toggleTheme();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded sc-focus sc-hover-card flex items-center gap-2" 
            style={{ color: 'var(--sc-text-dark)' }}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
          <div className="border-t my-1" style={{ borderColor: 'var(--sc-light-gray)' }} />
          <button disabled className="w-full text-left px-3 py-2 rounded opacity-60 cursor-not-allowed" style={{ color: 'var(--sc-text-light)' }}>Profile</button>
          <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded sc-focus sc-hover-card" style={{ color: 'var(--sc-text-dark)' }}>Logout</button>
        </div>
      )}
    </div>
  );
}