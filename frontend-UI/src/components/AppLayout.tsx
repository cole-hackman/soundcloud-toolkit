"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Home, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F2]">
        <div className="w-8 h-8 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F2]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="h-8 sm:h-10 md:h-12 overflow-hidden flex items-center">
                <Image
                  src="/sc toolkit transparent .png"
                  alt="SC Toolkit"
                  width={120}
                  height={40}
                  className="h-full w-auto object-contain"
                  priority
                />
              </div>
            </Link>

            <div className="flex items-center space-x-4 relative">
              <Link
                href="/dashboard"
                className="p-2 rounded text-[#666666] hover:text-[#FF5500] transition"
              >
                <Home className="w-5 h-5" />
              </Link>
              {user && (
                <ProfileMenu
                  user={{ name: user.display_name, avatar: user.avatar_url }}
                  onLogout={logout}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

function ProfileMenu({
  user,
  onLogout,
}: {
  user: { name: string; avatar: string };
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".profile-menu-container")) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  return (
    <div className="relative profile-menu-container">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 p-1 rounded"
      >
        <img
          src={user.avatar}
          alt={user.name}
          className="w-8 h-8 rounded-full border-2 border-[#FF5500]"
        />
        <span className="text-sm hidden sm:block text-[#666666]">
          {user.name}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg p-1 shadow-lg z-50 border border-gray-200">
          <button
            onClick={() => {
              toggleTheme();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center gap-2 text-[#333333]"
          >
            {theme === "dark" ? (
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
          <div className="border-t my-1 border-gray-200" />
          <button
            disabled
            className="w-full text-left px-3 py-2 rounded opacity-60 cursor-not-allowed text-[#666666]"
          >
            Profile
          </button>
          <button
            onClick={onLogout}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-[#333333]"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default AppLayout;

