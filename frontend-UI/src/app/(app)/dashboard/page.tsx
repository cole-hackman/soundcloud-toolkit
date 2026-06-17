"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import {
  Combine,
  Heart,
  Link as LinkIcon,
  ArrowRight,
  Shuffle,
  Search,
  ThumbsUp,
  Users,
  Stethoscope,
  ListChecks,
  ClipboardCheck,
  Download,
  Music,
  Copy,
  Repeat,
  Activity,
  ListMusic,
  Star,
  ArrowRightLeft,
  FileUp,
  History,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSurvey } from "@/contexts/SurveyContext";
import { Card, EmptyState, Input, PageContainer, Skeleton, Button } from "@/components/ui";
import { dashboardSummaryQueryOptions, useDashboardSummaryQuery } from "@/lib/queries";

const LAST_TOOLS_KEY = "sc-toolkit-last-tools";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
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
    id: "export",
    title: "Export",
    description: "Export likes, playlists, followings, and reposts as TXT or CSV",
    icon: FileUp,
    path: "/export",
  },
  {
    id: "library-audit",
    title: "Library Audit",
    description: "Scan playlists for duplicates, unavailable tracks, and download links",
    icon: ClipboardCheck,
    path: "/library-audit",
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
    id: "recently-played",
    title: "Recently Played",
    description: "View your last played tracks and save them to a playlist",
    icon: History,
    path: "/recently-played",
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
    id: "following-library",
    title: "Following Library",
    description: "Copy public likes and playlists from people you follow",
    icon: ListMusic,
    path: "/following-library",
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
  {
    id: "playlist-cloner",
    title: "Playlist Cloner",
    description: "Clone any public playlist to your account",
    icon: Copy,
    path: "/playlist-cloner",
  },
  {
    id: "playlist-compare",
    title: "Playlist Compare",
    description: "Compare two playlists for overlap and missing tracks",
    icon: ArrowRightLeft,
    path: "/playlist-compare",
  },
  {
    id: "genre-search",
    title: "Genre Search",
    description: "Discover tracks by genre or tag and add them to your playlists",
    icon: Music,
    path: "/genre-search",
  },
  {
    id: "repost-manager",
    title: "Repost Manager",
    description: "Browse and bulk-remove your reposts",
    icon: Repeat,
    path: "/repost-manager",
  },
  {
    id: "activity-to-playlist",
    title: "Activity → Playlist",
    description: "Create playlists directly from your feed",
    icon: Activity,
    path: "/activity-to-playlist",
  },
];

const RECENT_LABELS: Record<string, string> = {
  combine: "Combine Playlists",
  downloads: "Downloads",
  export: "Export",
  "library-audit": "Library Audit",
  likes: "Likes → Playlist",
  modifier: "Playlist Modifier",
  resolver: "Link Resolver",
  "like-manager": "Like Manager",
  "following-manager": "Following Manager",
  "following-library": "Following Library",
  "health-check": "Playlist Health Check",
  "batch-resolver": "Batch Link Resolver",
  "playlist-cloner": "Playlist Cloner",
  "playlist-compare": "Playlist Compare",
  "genre-search": "Genre Search",
  "repost-manager": "Repost Manager",
  "activity-to-playlist": "Activity → Playlist",
};

const RECENT_PATHS: Record<string, string> = {
  combine: "/combine",
  downloads: "/downloads",
  export: "/export",
  "library-audit": "/library-audit",
  likes: "/likes-to-playlist",
  modifier: "/playlist-modifier",
  resolver: "/link-resolver",
  "like-manager": "/like-manager",
  "following-manager": "/following-manager",
  "following-library": "/following-library",
  "health-check": "/playlist-health-check",
  "batch-resolver": "/batch-link-resolver",
  "playlist-cloner": "/playlist-cloner",
  "playlist-compare": "/playlist-compare",
  "genre-search": "/genre-search",
  "repost-manager": "/repost-manager",
  "activity-to-playlist": "/activity-to-playlist",
};

const COMING_SOON: FeatureCard[] = [];

// Separate Suspense component for fetching stats
function DashboardStats() {
  const { data: stats } = useSuspenseQuery(dashboardSummaryQueryOptions());

  const statsData = useMemo(
    () => [
      { label: "Playlists", value: stats?.playlist_count ?? 0, icon: ListMusic, link: "/combine" },
      { label: "Liked tracks", value: stats?.likes_count ?? 0, icon: Heart, link: "/like-manager" },
      { label: "Following", value: stats?.followings_count ?? 0, icon: Users, link: "/following-manager" },
      { label: "Followers", value: stats?.followers_count ?? 0, icon: Star, link: null },
    ],
    [stats]
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {statsData.map((stat, index) => {
        const cardContent = (
          <Card
            key={index}
            variant="glass"
            className={`p-3 sm:p-4 text-center ${stat.link ? "hover:-translate-y-0.5 hover:border-primary/50 transition-all cursor-pointer" : ""}`}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2 mx-auto">
              <stat.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-bold mb-0.5 text-foreground">
              {stat.value.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {stat.label}
            </div>
          </Card>
        );
        return stat.link ? (
          <Link key={index} href={stat.link}>{cardContent}</Link>
        ) : (
          <div key={index}>{cardContent}</div>
        );
      })}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="p-3 sm:p-4">
          <Skeleton className="mx-auto mb-2 h-8 w-8 rounded-lg" />
          <Skeleton className="mx-auto mb-1.5 h-4 w-16" />
          <Skeleton className="mx-auto h-3 w-20" />
        </Card>
      ))}
    </div>
  );
}

function StatsErrorFallback({ resetErrorBoundary }: { resetErrorBoundary: () => void }) {
  return (
    <Card className="p-6 mb-6">
      <EmptyState
        title="Couldn't load your stats"
        description="The backend may be sleeping or unreachable. Retry to refresh your dashboard."
        action={
          <Button onClick={resetErrorBoundary} variant="default">
            Retry
          </Button>
        }
      />
    </Card>
  );
}

export default function DashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const survey = useSurvey();
  const router = useRouter();
  const [linkUrl, setLinkUrl] = useState("");
  const [recentTools, setRecentTools] = useState<string[]>([]);
  const [toolQuery, setToolQuery] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      survey.maybeShow({ context: "dashboard" });
    }
  }, [authLoading, isAuthenticated, survey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_TOOLS_KEY);
      setRecentTools(stored ? JSON.parse(stored) : []);
    } catch {
      setRecentTools([]);
    }
  }, []);

  const handleResolveLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ url: trimmed });
    router.push(`/link-resolver?${params.toString()}`);
  };

  const filteredFeatures = useMemo(() => {
    const q = toolQuery.trim().toLowerCase();
    if (!q) return FEATURES;
    return FEATURES.filter((f) => {
      const hay = `${f.title} ${f.description} ${f.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [toolQuery]);

  return (
    <PageContainer maxWidth="default">
      {/* Welcome Section */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            Quick access to your tools, stats, and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {user?.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.display_name}
              className="w-10 h-10 rounded-full ring-2 ring-primary/20 shrink-0"
            />
          )}
        </div>
      </div>

      {/* Link Resolver Quick Input */}
      <Card variant="glass" className="p-3 sm:p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResolveLink()}
              placeholder="Paste a SoundCloud URL to resolve..."
              className="pl-10 text-sm h-10 bg-surface dark:bg-black/20"
            />
          </div>
          <Button
            onClick={handleResolveLink}
            disabled={!linkUrl.trim()}
            size="default"
            className="h-10"
          >
            <Search className="w-4 h-4" />
            Resolve
          </Button>
        </div>
      </Card>

      {/* Stats Section with Suspense and ErrorBoundary */}
      <ErrorBoundary FallbackComponent={StatsErrorFallback}>
        <Suspense fallback={<StatsSkeleton />}>
          <DashboardStats />
        </Suspense>
      </ErrorBoundary>

      {/* Recently Used */}
      {recentTools.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Recently used
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {recentTools.map((slug) => (
              <Link
                key={slug}
                href={RECENT_PATHS[slug] || "#"}
                className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/50 text-foreground hover:text-primary text-sm font-medium transition shadow-sm"
              >
                {RECENT_LABELS[slug] || slug}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tool search */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={toolQuery}
            onChange={(e) => setToolQuery(e.target.value)}
            placeholder="Search tools…"
            className="pl-9 h-10 bg-card"
          />
        </div>
      </div>

      {/* Quick Actions - Feature Cards */}
      {!toolQuery && (
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          All Tools
        </h2>
      )}
      {filteredFeatures.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No tools match your search" description="Try a different keyword." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {filteredFeatures.map((feature) => (
            <Card
              key={feature.id}
              interactive
              className="group p-4 sm:p-5"
            >
              <Link href={feature.path} className="block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-base font-bold mb-1 group-hover:text-primary transition text-foreground">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Coming Soon */}
      {COMING_SOON.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Coming soon
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {COMING_SOON.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  className="p-3 rounded-xl bg-card border border-border opacity-80 hover:opacity-100 hover:border-primary/40 transition shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mb-1.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground/50">Coming soon</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
