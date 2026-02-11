"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Combine,
  Heart,
  Link as LinkIcon,
  ArrowRight,
  Shuffle,
  Search,
  Activity,
  ThumbsUp,
  Users,
  Stethoscope,
  ListChecks,
  Download,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Input } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const LAST_TOOLS_KEY = "sc-toolkit-last-tools";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
}

interface UserStats {
  followers_count: number;
  followings_count: number;
  public_favorites_count: number;
  track_count: number;
  playlist_count: number;
}

const FEATURES: FeatureCard[] = [
  {
    id: "combine",
    title: "Combine Playlists",
    description: "Merge multiple playlists and remove duplicates automatically",
    icon: Combine,
    path: "/combine",
  },
  {
    id: "downloads",
    title: "Downloads",
    description: "Find downloadable tracks in your library",
    icon: Download,
    path: "/downloads",
  },
  {
    id: "likes",
    title: "Likes → Playlist",
    description: "Convert your liked tracks into an organized playlist",
    icon: Heart,
    path: "/likes-to-playlist",
  },
  {
    id: "modifier",
    title: "Playlist Modifier",
    description: "Reorder and remove tracks in your playlists",
    icon: Shuffle,
    path: "/playlist-modifier",
  },
  {
    id: "resolver",
    title: "Link Resolver",
    description: "Get detailed info from any SoundCloud link",
    icon: LinkIcon,
    path: "/link-resolver",
  },
  {
    id: "activity",
    title: "Activity → Playlist",
    description: "Save tracks from your activity feed into a playlist",
    icon: Activity,
    path: "/activity-to-playlist",
  },
  {
    id: "like-manager",
    title: "Like Manager",
    description: "Browse, search, and bulk-unlike your liked tracks",
    icon: ThumbsUp,
    path: "/like-manager",
  },
  {
    id: "following-manager",
    title: "Following Manager",
    description: "Browse and bulk-unfollow the users you follow",
    icon: Users,
    path: "/following-manager",
  },
  {
    id: "health-check",
    title: "Playlist Health Check",
    description: "Scan playlists for blocked or unavailable tracks",
    icon: Stethoscope,
    path: "/playlist-health-check",
  },
  {
    id: "batch-resolver",
    title: "Batch Link Resolver",
    description: "Resolve up to 50 SoundCloud URLs at once",
    icon: ListChecks,
    path: "/batch-link-resolver",
  },
];

const RECENT_LABELS: Record<string, string> = {
  combine: "Combine Playlists",
  downloads: "Downloads",
  likes: "Likes → Playlist",
  modifier: "Playlist Modifier",
  resolver: "Link Resolver",
  activity: "Activity → Playlist",
  "like-manager": "Like Manager",
  "following-manager": "Following Manager",
  "health-check": "Playlist Health Check",
  "batch-resolver": "Batch Link Resolver",
};

const RECENT_PATHS: Record<string, string> = {
  combine: "/combine",
  downloads: "/downloads",
  likes: "/likes-to-playlist",
  modifier: "/playlist-modifier",
  resolver: "/link-resolver",
  activity: "/activity-to-playlist",
  "like-manager": "/like-manager",
  "following-manager": "/following-manager",
  "health-check": "/playlist-health-check",
  "batch-resolver": "/batch-link-resolver",
};

const COMING_SOON: FeatureCard[] = [];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkUrl, setLinkUrl] = useState("");
  const [recentTools, setRecentTools] = useState<string[]>([]);

  useEffect(() => {
    fetchUserStats();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_TOOLS_KEY);
      setRecentTools(stored ? JSON.parse(stored) : []);
    } catch {
      setRecentTools([]);
    }
  }, []);

  const fetchUserStats = async () => {
    try {
      // Fetch user profile from SC API for follower/following/likes counts
      const [meRes, playlistsRes, likesRes, followingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/me`, { credentials: "include" }),
        fetch(`${API_BASE}/api/playlists?limit=1&offset=0`, { credentials: "include" }),
        fetch(`${API_BASE}/api/likes/paged?limit=1&offset=0`, { credentials: "include" }),
        fetch(`${API_BASE}/api/followings?limit=1&offset=0`, { credentials: "include" }),
      ]);

      let followers = 0;
      let followings = 0;
      let likes = 0;
      let playlists = 0;

      if (meRes.ok) {
        const userData = await meRes.json();
        console.log("[Dashboard] /api/me response:", userData);
        followers = userData.followers_count ?? 0;
        followings = userData.followings_count ?? 0;
        likes = userData.public_favorites_count ?? userData.likes_count ?? 0;
        playlists = userData.playlist_count ?? 0;
      } else {
        console.warn("[Dashboard] /api/me failed:", meRes.status);
      }

      // Fallback: count playlists from the playlists endpoint
      if (playlists === 0 && playlistsRes.ok) {
        const playlistData = await playlistsRes.json();
        console.log("[Dashboard] /api/playlists response:", playlistData);
        if (Array.isArray(playlistData)) {
          playlists = playlistData.length;
        } else if (playlistData.collection) {
          playlists = playlistData.total ?? playlistData.collection.length;
        }
      }

      // Fallback: count likes from the likes endpoint
      if (likes === 0 && likesRes.ok) {
        const likesData = await likesRes.json();
        console.log("[Dashboard] /api/likes/paged response:", likesData);
        if (likesData.total != null) {
          likes = likesData.total;
        } else if (likesData.collection) {
          likes = likesData.collection.length;
        }
      }

      // Fallback: count followings from the followings endpoint
      if (followings === 0 && followingsRes.ok) {
        const followingsData = await followingsRes.json();
        console.log("[Dashboard] /api/followings response:", followingsData);
        if (followingsData.total != null) {
          followings = followingsData.total;
        } else if (followingsData.collection) {
          followings = followingsData.collection.length;
        }
      }

      setStats({
        followers_count: followers,
        followings_count: followings,
        public_favorites_count: likes,
        track_count: 0,
        playlist_count: playlists,
      });
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ url: trimmed });
    router.push(`/link-resolver?${params.toString()}`);
  };

  const statsData = [
    { label: "Playlists", value: stats?.playlist_count ?? 0, icon: "📋" },
    { label: "Liked Tracks", value: stats?.public_favorites_count ?? 0, icon: "❤️" },
    { label: "Following", value: stats?.followings_count ?? 0, icon: "👥" },
    { label: "Followers", value: stats?.followers_count ?? 0, icon: "⭐" },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-background">
      <div className="mx-auto px-4 sm:px-6 py-5 sm:py-6 max-w-5xl">
        {/* Welcome Section */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#333333] dark:text-foreground">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-[#FF5500] to-[#E64A00] bg-clip-text text-transparent">
                {user?.display_name}
              </span>
            </h1>
            <p className="text-sm mt-0.5 text-[#888888] dark:text-muted-foreground">
              Choose a tool to enhance your SoundCloud experience
            </p>
          </div>
          {user?.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.display_name}
              className="w-10 h-10 rounded-full ring-2 ring-[#FF5500]/20 shrink-0"
            />
          )}
        </div>

        {/* Link Resolver Quick Input */}
        <Card className="p-3 sm:p-4 mb-5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999] dark:text-muted-foreground" />
              <Input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResolveLink()}
                placeholder="Paste a SoundCloud URL to resolve..."
                className="pl-10 text-sm h-9"
              />
            </div>
            <button
              onClick={handleResolveLink}
              disabled={!linkUrl.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              Resolve
            </button>
          </div>
        </Card>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="p-3 sm:p-4 text-center">
                  <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 bg-gray-200 dark:bg-secondary animate-pulse" />
                  <div className="w-14 h-3.5 rounded mx-auto bg-gray-200 dark:bg-secondary animate-pulse" />
                </Card>
              ))
            : statsData.map((stat, index) => (
                <Card
                  key={index}
                  className="p-3 sm:p-4 text-center hover:-translate-y-0.5"
                >
                  <div className="text-lg mb-1">{stat.icon}</div>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5 text-[#333333] dark:text-foreground">
                    {stat.value.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-medium text-[#999999] dark:text-muted-foreground uppercase tracking-wide">
                    {stat.label}
                  </div>
                </Card>
              ))}
        </div>

        {/* Recently Used */}
        {recentTools.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#999999] dark:text-muted-foreground mb-2">
              Recently used
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {recentTools.map((slug) => (
                <Link
                  key={slug}
                  href={RECENT_PATHS[slug] || "#"}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-card border border-gray-200 dark:border-border hover:border-[#FF5500]/50 dark:hover:border-[#FF5500]/50 text-[#555555] dark:text-muted-foreground text-xs font-medium transition shadow-sm"
                >
                  {RECENT_LABELS[slug] || slug}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions - Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {FEATURES.map((feature) => (
            <Card
              key={feature.id}
              className="group p-4 sm:p-5 hover:-translate-y-0.5"
            >
              <Link href={feature.path} className="block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white shadow-sm">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#FF5500] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-base font-bold mb-1 group-hover:text-[#FF5500] transition text-[#333333] dark:text-foreground">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-sm text-[#888888] dark:text-muted-foreground">
                  {feature.description}
                </p>
              </Link>
            </Card>
          ))}
        </div>



        {/* Coming Soon */}
        {COMING_SOON.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#999999] dark:text-muted-foreground mb-2">
            Coming soon
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {COMING_SOON.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  className="p-3 rounded-xl bg-white dark:bg-card border border-gray-200 dark:border-border opacity-80 hover:opacity-100 hover:border-[#FF5500]/40 transition shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-secondary flex items-center justify-center mb-1.5">
                    <Icon className="w-4 h-4 text-[#AAAAAA] dark:text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium text-[#777777] dark:text-muted-foreground">
                    {item.title}
                  </p>
                  <span className="text-[10px] text-[#BBBBBB] dark:text-muted-foreground/50">Coming soon</span>
                </Link>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
