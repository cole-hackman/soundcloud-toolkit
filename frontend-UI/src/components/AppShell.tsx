"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Combine,
  Heart,
  Shuffle,
  Link as LinkIcon,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Shield,
  LogOut,
  Moon,
  Sun,
  Activity,
  ThumbsUp,
  Users,
  Stethoscope,
  ListChecks,
  Download,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/* ── Navigation structure ── */

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavLink[];
}

type NavEntry = NavLink | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/downloads", label: "Downloads", icon: Download },
  {
    label: "Playlists",
    items: [
      { href: "/combine", label: "Combine Playlists", icon: Combine },
      { href: "/playlist-modifier", label: "Playlist Modifier", icon: Shuffle },
      { href: "/playlist-health-check", label: "Health Check", icon: Stethoscope },
      { href: "/activity-to-playlist", label: "Activity → Playlist", icon: Activity },
    ],
  },
  {
    label: "Likes & Following",
    items: [
      { href: "/likes-to-playlist", label: "Likes → Playlist", icon: Heart },
      { href: "/like-manager", label: "Like Manager", icon: ThumbsUp },
      { href: "/following-manager", label: "Following Manager", icon: Users },
    ],
  },
  {
    label: "Links",
    items: [
      { href: "/link-resolver", label: "Link Resolver", icon: LinkIcon },
      { href: "/batch-link-resolver", label: "Batch Resolver", icon: ListChecks },
    ],
  },
];

const FOOTER_ITEMS = [
  { href: "/about", label: "About", icon: FileText },
  { href: "/privacy", label: "Privacy", icon: Shield },
];

/* ── Collapsible sidebar group ── */

function SidebarGroup({
  group,
  pathname,
  collapsed,
  isMobile,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  isMobile: boolean;
  onNavigate?: () => void;
}) {
  // Auto-open if any child is active
  const hasActive = group.items.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
  );
  const [open, setOpen] = useState(true);

  // Keep in sync when route changes
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  // When collapsed (icon-only sidebar), just show the first item's icon
  if (collapsed && !isMobile) {
    return (
      <div className="space-y-0.5">
        {group.items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                "flex items-center justify-center px-3 py-2 rounded-lg transition-all duration-150 relative",
                isActive
                  ? "bg-[#FF5500]/8 text-[#FF5500]"
                  : "text-[#555555] hover:bg-black/[0.04] hover:text-[#333333]"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#FF5500] rounded-r-full" />
              )}
              <Icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-[#FF5500]" : "")} />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#999999] hover:text-[#666666] transition-colors"
      >
        <span>{group.label}</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            open ? "" : "-rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 pl-5 pr-3 py-2 rounded-lg transition-all duration-150 text-[13px] font-medium relative",
                  isActive
                    ? "bg-[#FF5500]/8 text-[#FF5500]"
                    : "text-[#555555] hover:bg-black/[0.04] hover:text-[#333333]"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#FF5500] rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "w-[16px] h-[16px] shrink-0",
                    isActive ? "text-[#FF5500]" : ""
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Shell ── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Determine effective collapsed state (expanded if hovered)
  const effectiveCollapsed = sidebarCollapsed && !isHovered;

  // Persist sidebar state in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sc-toolkit-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("sc-toolkit-sidebar-collapsed", String(next));
  };

  const closeMobile = () => setMobileOpen(false);

  /* ── Sidebar navigation renderer ── */
  const SidebarNav = ({
    isMobile = false,
    onNavigate,
  }: {
    isMobile?: boolean;
    onNavigate?: () => void;
  }) => (
    <nav className="flex-1 overflow-y-auto py-3">
      <div className="space-y-1 px-2">
        {NAV.map((entry, i) => {
          if (isGroup(entry)) {
            return (
              <SidebarGroup
                key={entry.label}
                group={entry}
                pathname={pathname}
                  collapsed={effectiveCollapsed}
                isMobile={isMobile}
                onNavigate={onNavigate}
              />
            );
          }

          // Top-level link (Dashboard)
          const Icon = entry.icon;
          const isActive =
            pathname === entry.href ||
            pathname?.startsWith(entry.href + "/");
          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-[13px] font-medium relative",
                  isActive
                  ? "bg-[#FF5500]/8 text-[#FF5500]"
                  : "text-[#555555] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-[#333333] dark:hover:text-white"
              )}
            >
              {isActive && !effectiveCollapsed && !isMobile && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#FF5500] rounded-r-full" />
              )}
              {isActive && isMobile && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#FF5500] rounded-r-full" />
              )}
              <Icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0",
                  isActive ? "text-[#FF5500]" : ""
                )}
              />
              {(isMobile || !effectiveCollapsed) && (
                <span className="truncate">{entry.label}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mx-4 my-3 border-t border-gray-200/80 dark:border-border" />

      <div className="px-2 mb-1">
        <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#999999] dark:text-[#71717a]">
          Info
        </span>
      </div>
      <div className="space-y-0.5 px-2 mb-6">
        {FOOTER_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#777777] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-[#333333] dark:hover:text-white transition-all duration-150 text-[13px] font-medium"
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {(isMobile || !effectiveCollapsed) && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User Profile Section (Inline) */}
      <div className="px-2 mt-4">
        {(!effectiveCollapsed || isMobile) ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <img
              src={user?.avatar_url || "/SC Toolkit Icon.png"}
              alt={user?.display_name || "User"}
              className="w-6 h-6 rounded-full ring-1 ring-[#FF5500]/20 shrink-0"
            />
            <span className="text-[13px] font-medium text-[#333333] dark:text-foreground truncate flex-1">
              {user?.display_name}
            </span>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#888888] dark:text-[#a1a1aa] transition"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#888888] dark:text-[#a1a1aa] hover:text-[#FF5500] dark:hover:text-[#FF5500] transition"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Collapsed state: Stacked column of avatars/icons */
          <div className="flex flex-col items-center gap-4 py-2">
             <img
              src={user?.avatar_url || "/SC Toolkit Icon.png"}
              alt={user?.display_name || "User"}
              className="w-6 h-6 rounded-full ring-1 ring-[#FF5500]/20 shrink-0"
            />
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#888888] dark:text-[#a1a1aa] transition"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#888888] dark:text-[#a1a1aa] hover:text-[#FF5500] dark:hover:text-[#FF5500] transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[#F2F2F2] dark:bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-gradient-to-b from-[#FAFAFA] to-white dark:from-background dark:to-background border-r border-gray-200/80 dark:border-border transition-all duration-200 shrink-0",
          effectiveCollapsed ? "w-[56px]" : "w-56"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-[#FF5500] to-[#FF7733] shrink-0" />

        <div className="flex items-center justify-between h-12 px-3 border-b border-gray-200/80 dark:border-border shrink-0">
          {effectiveCollapsed ? (
            <button
              onClick={toggleSidebar}
              className="flex items-center min-w-0 cursor-pointer"
              aria-label="Expand sidebar"
            >
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded flex items-center justify-center">
                <Image
                  src="/sc toolkit transparent .png"
                  alt="SC Toolkit"
                  width={28}
                  height={28}
                  className="h-7 w-auto object-contain"
                />
              </div>
            </button>
          ) : (
            <Link href="/dashboard" className="flex items-center min-w-0">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded flex items-center justify-center">
                <Image
                  src="/sc toolkit transparent .png"
                  alt="SC Toolkit"
                  width={28}
                  height={28}
                  className="h-7 w-auto object-contain"
                />
              </div>
              <span className="ml-2 font-bold text-sm text-[#333333] dark:text-foreground truncate">
                SC Toolkit
              </span>
            </Link>
          )}
          {!effectiveCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#999999] dark:text-[#a1a1aa] hidden lg:flex"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <SidebarNav />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-background/95 backdrop-blur-sm border-b border-gray-200/80 dark:border-border h-12 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#666666] dark:text-[#a1a1aa]"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/sc toolkit transparent .png"
            alt="SC Toolkit"
            width={90}
            height={28}
            className="h-7 w-auto object-contain"
          />
        </Link>
        <div className="w-8" />
      </div>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside className="lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-gradient-to-b from-[#FAFAFA] to-white dark:from-background dark:to-background border-r border-gray-200/80 dark:border-border z-50 flex flex-col shadow-xl">
            {/* Top accent bar */}
            <div className="h-[2px] bg-gradient-to-r from-[#FF5500] to-[#FF7733] shrink-0" />

            <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200/80 dark:border-border">
              <span className="font-bold text-sm text-[#333333] dark:text-foreground">Menu</span>
              <button
                onClick={closeMobile}
                className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#666666] dark:text-[#a1a1aa]"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SidebarNav isMobile onNavigate={closeMobile} />
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-12 lg:pt-0">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  );
}
