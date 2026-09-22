"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sun,
} from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { NAV, isGroup, type NavGroup, type NavLink } from "@/lib/nav";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { LiveRegion } from "@/components/ui/LiveRegion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

/* ── Navigation structure ──
   `NAV`, its types and `isGroup` live in `@/lib/nav` so pages that only need
   the tool list (the feedback form resolving `?from=` to a tool name) can
   read it without importing this component. */

/** The drawer's `<nav>`, so the hamburger can point `aria-controls` at it. */
const MOBILE_NAV_ID = "mobile-nav";

const FOOTER_ITEMS: NavLink[] = [
  { href: "/about", label: "About", icon: FileText },
  { href: "/privacy", label: "Privacy", icon: Shield },
  { href: "/accessibility", label: "Accessibility", icon: Shield },
];

/**
 * `/dashboard/` is how the static export addresses the route and `/dashboard`
 * is how `NAV` writes it, so an exact match is not enough on its own.
 */
function isActivePath(pathname: string | null, href: string): boolean {
  return pathname === href || !!pathname?.startsWith(href + "/");
}

/* ── One nav row ── */

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
  indented = false,
  iconSize = "w-[18px] h-[18px]",
}: {
  item: NavLink;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  indented?: boolean;
  iconSize?: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-lg transition-colors duration-150 text-[13px] font-medium py-2",
        indented ? "pl-5 pr-3" : "px-3",
        collapsed && "justify-center",
        active ? "bg-primary/10 text-primary-text" : "text-muted-foreground",
      )}
    >
      {/* Slide-in hover bg */}
      {!active && (
        <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-0 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] transition-transform duration-200" />
      )}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
      )}
      <Icon
        className={cn(
          "relative z-10 shrink-0",
          iconSize,
          active
            ? "text-primary-text"
            : "group-hover:text-foreground dark:group-hover:text-white transition-colors",
        )}
      />
      {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
    </Link>
  );
}

/* ── Collapsible sidebar group ── */

function SidebarGroup({
  group,
  pathname,
  collapsed,
  isMobile,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string | null;
  collapsed: boolean;
  isMobile: boolean;
  onNavigate?: () => void;
}) {
  // Auto-open if any child is active
  const hasActive = group.items.some((item) => isActivePath(pathname, item.href));
  const [open, setOpen] = useState(true);
  const listId = useId();

  // Keep in sync when route changes
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  // When collapsed (icon-only sidebar), just show the items' icons
  if (collapsed && !isMobile) {
    return (
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActivePath(pathname, item.href)}
            collapsed
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{group.label}</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            open ? "" : "-rotate-90",
          )}
        />
      </button>

      {/* Rendered in both states, `hidden` when closed, so `aria-controls`
          always resolves to a real element. */}
      <div id={listId} hidden={!open} className="space-y-0.5">
        {group.items.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActivePath(pathname, item.href)}
            collapsed={false}
            onNavigate={onNavigate}
            indented
            iconSize="w-[16px] h-[16px]"
          />
        ))}
      </div>
    </div>
  );
}

/* ── Sidebar navigation ──
   A module-level component, not a closure declared inside `AppShell`: a
   nested definition is a new component type on every render, so React
   remounted the whole sidebar — and reset every group's open/closed state,
   which is now exposed as `aria-expanded` — whenever the shell re-rendered.
   Hovering the rail does exactly that. */

function SidebarNav({
  collapsed,
  isMobile = false,
  onNavigate,
  navId,
  onDeleteAccount,
  deleteAccountRef,
}: {
  collapsed: boolean;
  isMobile?: boolean;
  onNavigate?: () => void;
  navId?: string;
  onDeleteAccount: () => void;
  deleteAccountRef?: React.RefObject<HTMLButtonElement>;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      id={navId}
      aria-label={isMobile ? "Main navigation" : "Main"}
      className="flex-1 overflow-y-auto py-3"
    >
      <div className="space-y-1 px-2">
        {NAV.map((entry) => {
          if (isGroup(entry)) {
            return (
              <SidebarGroup
                key={entry.label}
                group={entry}
                pathname={pathname}
                collapsed={collapsed}
                isMobile={isMobile}
                onNavigate={onNavigate}
              />
            );
          }

          // Top-level link (Dashboard)
          return (
            <NavRow
              key={entry.href}
              item={entry}
              active={isActivePath(pathname, entry.href)}
              collapsed={collapsed && !isMobile}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>

      <div className="mx-4 my-3 border-t border-gray-200/80 dark:border-border" />

      <div className="px-2 mb-1">
        <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Info
        </span>
      </div>
      <div className="space-y-0.5 px-2 mb-6">
        {FOOTER_ITEMS.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActivePath(pathname, item.href)}
            collapsed={collapsed && !isMobile}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* User Profile Section (Inline) */}
      <div className="px-2 mt-4">
        {!collapsed || isMobile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <img
                src={user?.avatar_url || "/brand/icon-192.png"}
                alt={user?.display_name || "User"}
                width={24}
                height={24}
                loading="lazy"
                decoding="async"
                className="w-6 h-6 rounded-full ring-1 ring-primary/20 shrink-0"
              />
              <span className="text-[13px] font-medium text-foreground truncate flex-1">
                {user?.display_name}
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-muted-foreground transition"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-muted-foreground hover:text-primary dark:hover:text-primary transition"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 pb-2">
              <a
                href="https://www.buymeacoffee.com/hackman"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-black bg-[#fcffff] px-3 py-2 text-[12px] font-semibold text-black shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
              >
                <span className="text-[14px] leading-none">☕</span>
                <span>Support Me</span>
              </a>
              <button
                type="button"
                ref={deleteAccountRef}
                onClick={onDeleteAccount}
                className="mt-2 w-full text-center text-xs text-muted-foreground-subtle hover:text-destructive-text transition"
              >
                Delete account
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed state: Stacked column of avatars/icons */
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={user?.avatar_url || "/brand/icon-192.png"}
              alt={user?.display_name || "User"}
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              className="w-6 h-6 rounded-full ring-1 ring-primary/20 shrink-0"
            />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-muted-foreground transition"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-muted-foreground hover:text-primary dark:hover:text-primary transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <a
              href="https://www.buymeacoffee.com/hackman"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black bg-[#fcffff] text-[14px] leading-none text-black shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
              aria-label="Support me on Buy Me a Coffee"
              title="Support Me"
            >
              ☕
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}

/* ── Main Shell ── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const deleteAccountTriggerRef = useRef<HTMLButtonElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Chromium does not focus a <button> on a mouse click, so the element the
  // dialog would otherwise restore to is <body>. Naming the trigger keeps the
  // drawer's focus return correct however it was opened.
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || deletingAccount) return;
    setDeletingAccount(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/account`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
    } catch {
      // fall through to re-enable the button
    }
    setDeletingAccount(false);
  };

  const openDeleteAccount = () => {
    setDeleteConfirmText("");
    setDeleteAccountOpen(true);
  };

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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-gradient-to-b from-[#FAFAFA] to-white dark:from-background dark:to-background border-r border-gray-200/80 dark:border-border transition-all duration-200 shrink-0",
          effectiveCollapsed ? "w-[56px]" : "w-56",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-[#FF5500] to-[#FF7733] shrink-0" />

        <div className="flex items-center justify-between h-12 px-3 border-b border-gray-200/80 dark:border-border shrink-0">
          {effectiveCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex items-center min-w-0 cursor-pointer"
              aria-label="Expand sidebar"
            >
              <BrandMark className="h-7 w-7 shrink-0" />
            </button>
          ) : (
            <Link href="/dashboard" className="flex items-center min-w-0">
              <BrandMark title="" className="h-7 w-7 shrink-0" />
              <span className="ml-2 font-bold text-sm text-foreground truncate">
                Track Toolkit
              </span>
            </Link>
          )}
          {!effectiveCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-muted-foreground-subtle hidden lg:flex"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <SidebarNav
          collapsed={effectiveCollapsed}
          onDeleteAccount={openDeleteAccount}
          deleteAccountRef={deleteAccountTriggerRef}
        />
      </aside>

      {/* Mobile header */}
      <header
        className="lg:hidden fixed left-0 right-0 z-50 bg-white/95 dark:bg-background/95 backdrop-blur-sm border-b border-gray-200/80 dark:border-border h-12 flex items-center justify-between px-4"
        style={{ top: "var(--announcement-h)" }}
      >
        <button
          type="button"
          ref={menuButtonRef}
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-muted-foreground"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls={MOBILE_NAV_ID}
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="flex items-center">
          <BrandWordmark className="h-7 w-auto text-foreground" />
        </Link>
        <div className="w-8" />
      </header>

      {/* Mobile drawer. A real dialog: the focus trap, Escape, focus return
          and body scroll lock all come from the shared primitive, and the
          drawer variant offsets itself by the rebrand banner's height. */}
      <Dialog
        open={mobileOpen}
        onClose={closeMobile}
        title="Menu"
        variant="drawer"
        closeLabel="Close menu"
        returnFocusRef={menuButtonRef}
      >
        <SidebarNav
          isMobile
          collapsed={false}
          onNavigate={closeMobile}
          navId={MOBILE_NAV_ID}
          onDeleteAccount={openDeleteAccount}
        />
      </Dialog>

      {/* Main content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 min-w-0 min-h-0 pt-12 lg:pt-0 focus:outline-none"
      >
        {/* The app's only live region — everything `useAnnounce` says lands here. */}
        <LiveRegion />
        {children}
      </main>

      <ConfirmDialog
        open={deleteAccountOpen}
        title="Delete your account?"
        description="This permanently deletes your Track Toolkit account and everything stored with it — your login, connected SoundCloud tokens, and all operation history. Your SoundCloud account and playlists are not affected. This cannot be undone."
        confirmLabel={deletingAccount ? "Deleting…" : "Delete my account"}
        variant="destructive"
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteAccountOpen(false)}
        returnFocusRef={deleteAccountTriggerRef}
      >
        <label className="block text-xs text-muted-foreground" htmlFor="delete-account-confirm">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </label>
        <input
          id="delete-account-confirm"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40"
          placeholder="DELETE"
          autoComplete="off"
        />
      </ConfirmDialog>
    </div>
  );
}
