"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Sparkles,
  History,
  Search,
  Check,
  Loader2,
  ExternalLink,
  UserPlus,
  RefreshCw,
  Undo2,
  Play,
  Heart,
  ChevronRight,
  Info,
  Clock,
  ShieldAlert,
  BarChart3,
  Download,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  Card,
  Button,
  InlineAlert,
  EmptyState,
  ConfirmDialog,
  BulkReviewDetails,
  SelectionBanner,
  Input
} from "@/components/ui";
import { ProgressiveBlur } from "@/components/ui/ProgressiveBlur";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import {
  followingsQueryOptions,
  invalidateDashboardSummary
} from "@/lib/queries";

const RISK_ACK_KEY = "sc-toolkit-growth-risk-ack";

interface Following {
  id: number;
  username: string;
  avatar_url: string;
  permalink_url: string;
  followers_count: number;
  track_count: number;
}

interface Suggestion {
  user: {
    id: number;
    username: string;
    avatar_url: string;
    permalink_url: string;
    followers_count: number;
    followings_count: number;
    track_count: number;
  };
  score: number;
  scoreLabel: 'high' | 'medium' | 'low';
  signals: {
    followBackRatio: number;
    sharedInspirationCount: number;
    isRelatedArtist: boolean;
    isCreator: boolean;
  };
  suggestedTrack: {
    id: number;
    title: string;
    artwork_url: string;
    likes_count: number;
    playback_count: number;
    permalink_url: string;
  } | null;
}

interface GrowthAction {
  id: string;
  actionType: 'follow' | 'like';
  targetId: number;
  targetName: string | null;
  targetAvatar: string | null;
  targetFollowers: number | null;
  targetFollowings: number | null;
  followedBack: boolean | null;
  checkedAt: string | null;
  reversed: boolean;
  reversedAt: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  createdAt: string;
}

interface SessionGroup {
  sessionId: string;
  label: string;
  date: string;
  totalActions: number;
  followedBack: number;
  notFollowedBack: number;
  unchecked: number;
  reversed: number;
}

interface DiscoveryStats {
  inspirationUsers: number;
  candidatesScanned: number;
  afterDedup: number;
  suggestionsReturned: number;
  seedGenres?: string[];
}

interface GrowthBudget {
  dailyCap: number;
  used24h: number;
  remaining: number;
  cooldownRemainingMs: number;
}

interface EngageJob {
  sessionId: string;
  sessionLabel: string;
  status: "running" | "complete" | "cancelled" | "error";
  current: number;
  total: number;
  followed: number;
  liked: number;
  errorCount: number;
  likeTracks: boolean;
}

interface SeedConversion {
  seedId: string;
  name: string;
  follows: number;
  followedBack: number;
  checked: number;
  rate: number | null;
}

export default function GrowthPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"discover" | "history" | "analytics">("discover");

  // Tab 1: Discover state
  const [selectedInspirations, setSelectedInspirations] = useState<Set<number>>(new Set());
  const [strategy, setStrategy] = useState<'followers' | 'followings' | 'both'>('followers');
  const [discoveryStep, setDiscoveryStep] = useState<1 | 2 | 3 | 4>(1);
  const [searchInspirations, setSearchInspirations] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [discoveryStats, setDiscoveryStats] = useState<DiscoveryStats | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [likeTracks, setLikeTracks] = useState(false); // auto-like is opt-in
  const [recentEngagedCount, setRecentEngagedCount] = useState({ followed: 0, liked: 0 });

  // Engagement job (server-paced batch)
  const [job, setJob] = useState<EngageJob | null>(null);

  // Risk interstitial
  const [showRiskModal, setShowRiskModal] = useState(false);

  // Tab 2: History state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedHistoryActions, setSelectedHistoryActions] = useState<Set<string>>(new Set());
  const [reversing, setReversing] = useState(false);
  const [checkingFollowbacks, setCheckingFollowbacks] = useState(false);
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);

  // General Notification
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info" | "warning"; text: string } | null>(null);

  // Fetch followings for Step 1
  const { data: followingsData, isLoading: isLoadingFollowings } = useSuspenseQuery(followingsQueryOptions());
  const followings = (followingsData?.collection || []) as unknown as Following[];

  // Fetch History & Stats
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['growth', 'history'],
    queryFn: async () => {
      const res = await apiFetch("/api/growth/history");
      return res.json() as Promise<{ actions: GrowthAction[]; sessions: SessionGroup[] }>;
    },
    enabled: activeTab === 'history',
  });

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['growth', 'stats'],
    queryFn: async () => {
      const res = await apiFetch("/api/growth/stats");
      return res.json() as Promise<{
        totalFollowed: number;
        totalLiked: number;
        followedBackRate: number;
        activeFollows: number;
        reversedFollows: number;
        uncheckedFollows: number;
      }>;
    },
    enabled: activeTab === 'history' || activeTab === 'analytics',
  });

  // Daily follow budget + cooldown
  const { data: budget, refetch: refetchBudget } = useQuery({
    queryKey: ['growth', 'limits'],
    queryFn: async () => {
      const res = await apiFetch("/api/growth/limits");
      return res.json() as Promise<GrowthBudget>;
    },
  });

  // Per-seed conversion analytics
  const { data: analytics } = useQuery({
    queryKey: ['growth', 'analytics'],
    queryFn: async () => {
      const res = await apiFetch("/api/growth/analytics");
      return res.json() as Promise<{
        perSeed: SeedConversion[];
        followBackCurve: { bucket: string; followedBack: number; notFollowedBack: number }[];
        totalFollows: number;
      }>;
    },
    enabled: activeTab === 'analytics',
  });

  // Discovery Mutation
  const discoverMutation = useMutation({
    mutationFn: async (payload: { inspirationUserIds: number[]; strategy: string }) => {
      setDiscoveryStep(2);
      const res = await apiFetch("/api/growth/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to run discovery");
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      setDiscoveryStats(data.stats);
      // Select all high and medium suggestions by default
      const autoSelected = new Set<number>(
        data.suggestions
          .filter((s: Suggestion) => s.score >= 40)
          .map((s: Suggestion) => s.user.id)
      );
      setSelectedSuggestions(autoSelected);
      setDiscoveryStep(3);
    },
    onError: (err: Error) => {
      setNotice({ type: "error", text: err.message || "Failed to scan networks. SoundCloud might be rate limiting." });
      setDiscoveryStep(1);
    }
  });

  // Start a server-paced engagement batch. The server enforces the daily
  // cap + cooldown and runs the follows in the background; we poll status.
  const startEngagement = async () => {
    if (selectedSuggestions.size === 0) return;
    setShowRiskModal(false);

    const selectedList = suggestions.filter(s => selectedSuggestions.has(s.user.id));
    const seedFollowings = followings.filter(f => selectedInspirations.has(f.id));
    const inspirationNames = seedFollowings.map(f => f.username).join(",");
    const shortNames = seedFollowings.map(f => f.username).slice(0, 3).join(", ");
    const sessionLabel = `Seed: ${shortNames}${selectedInspirations.size > 3 ? "…" : ""} — ${new Date().toLocaleDateString()}`;

    const targets = selectedList.map(s => ({
      userId: s.user.id,
      likeTrackId: likeTracks ? s.suggestedTrack?.id ?? null : null,
      targetName: s.user.username,
      targetAvatar: s.user.avatar_url,
      targetFollowers: s.user.followers_count,
      targetFollowings: s.user.followings_count,
    }));

    try {
      const res = await apiFetch("/api/growth/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets,
          likeTracks,
          sessionLabel,
          inspirationIds: Array.from(selectedInspirations).join(","),
          inspirationNames,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: "error", text: data.error || "Failed to start engagement batch." });
        if (data.budget) refetchBudget();
        return;
      }
      setJob(data.job);
      setNotice({
        type: "info",
        text: `Engagement started — following ${targets.length} user${targets.length === 1 ? "" : "s"} at a safe pace. You can leave this page; it runs in the background.`,
      });
    } catch {
      setNotice({ type: "error", text: "Failed to start engagement batch." });
    }
  };

  // Poll engagement job status while one is running
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch("/api/growth/engage/status");
        const data = await res.json();
        if (data.job) {
          setJob(data.job);
          if (data.job.status !== "running") {
            clearInterval(interval);
            setRecentEngagedCount({ followed: data.job.followed, liked: data.job.liked });
            setDiscoveryStep(4);
            refetchBudget();
            invalidateDashboardSummary(queryClient);
          }
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [job, queryClient, refetchBudget]);

  const cancelEngagement = async () => {
    try {
      await apiFetch("/api/growth/engage/cancel", { method: "POST" });
      setNotice({ type: "info", text: "Cancelling after the current action…" });
    } catch {
      /* ignore */
    }
  };

  // Confirm-or-run entry point for the engage banner
  const handleEngageClick = () => {
    if (selectedSuggestions.size === 0) return;
    const acked = typeof window !== "undefined" && localStorage.getItem(RISK_ACK_KEY) === "true";
    if (acked) {
      startEngagement();
    } else {
      setShowRiskModal(true);
    }
  };

  const acknowledgeRiskAndEngage = () => {
    try {
      localStorage.setItem(RISK_ACK_KEY, "true");
    } catch {
      /* ignore */
    }
    startEngagement();
  };

  // Track preview — the stream file is auth-gated, so open the track on
  // SoundCloud in a new tab as the reliable preview.
  const previewTrack = useCallback((track: NonNullable<Suggestion["suggestedTrack"]>) => {
    window.open(track.permalink_url, "_blank", "noopener");
  }, []);

  const exportSessionCsv = (sessionLabel: string, actions: GrowthAction[]) => {
    const rows: unknown[][] = [
      ["Target", "Action", "Followed Back", "Reversed", "Date"],
      ...actions.map((a) => [
        a.targetName || "",
        a.actionType,
        a.followedBack === null ? "unchecked" : a.followedBack ? "yes" : "no",
        a.reversed ? "yes" : "no",
        new Date(a.createdAt).toISOString(),
      ]),
    ];
    const safe = sessionLabel.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
    downloadCsv(`growth-${safe || "session"}.csv`, rows);
  };

  // Followback Checker Mutation
  const checkFollowbacksMutation = useMutation({
    mutationFn: async (sessId: string | null) => {
      setCheckingFollowbacks(true);
      const res = await apiFetch("/api/growth/check-followbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessId }),
      });
      if (!res.ok) throw new Error("Failed to check followbacks");
      return res.json();
    },
    onSuccess: (data) => {
      setNotice({
        type: "success",
        text: `Checked ${data.checked} users. Found ${data.followedBack} new followbacks! (${data.alreadyChecked} skipped on cooldown)`
      });
      refetchHistory();
      refetchStats();
    },
    onError: (err: Error) => {
      setNotice({ type: "error", text: err.message || "Failed to verify followbacks." });
    },
    onSettled: () => {
      setCheckingFollowbacks(false);
    }
  });

  // Reversal Mutation
  const reverseMutation = useMutation({
    mutationFn: async (payload: { 
      actionIds?: string[]; 
      filter?: { sessionId?: string; followedBack?: boolean; actionType?: 'follow' | 'like' } 
    }) => {
      setReversing(true);
      const res = await apiFetch("/api/growth/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Reversal failed");
      return res.json();
    },
    onSuccess: (data) => {
      setNotice({
        type: "success",
        text: `Successfully reversed ${data.reversed} actions. (${data.failed} failed)`
      });
      setSelectedHistoryActions(new Set());
      refetchHistory();
      refetchStats();
      invalidateDashboardSummary(queryClient);
    },
    onError: (err: Error) => {
      setNotice({ type: "error", text: err.message || "Failed to reverse actions." });
    },
    onSettled: () => {
      setReversing(false);
      setShowReverseConfirm(false);
    }
  });

  // Helper formatting functions
  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const handleInspirationClick = (id: number) => {
    setSelectedInspirations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 5) {
          setNotice({ type: "error", text: "You can select a maximum of 5 seed users." });
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const toggleSuggestion = (id: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSuggestions = () => {
    if (selectedSuggestions.size === suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(suggestions.map(s => s.user.id)));
    }
  };

  const toggleHistoryAction = (id: string) => {
    setSelectedHistoryActions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllHistoryActions = (actions: GrowthAction[]) => {
    if (selectedHistoryActions.size === actions.length) {
      setSelectedHistoryActions(new Set());
    } else {
      setSelectedHistoryActions(new Set(actions.map(a => a.id)));
    }
  };

  const filteredInspirations = followings.filter(f =>
    !searchInspirations || f.username?.toLowerCase().includes(searchInspirations.toLowerCase())
  );

  const selectedSession = historyData?.sessions.find(s => s.sessionId === selectedSessionId);
  const sessionActions = historyData?.actions.filter(a => a.sessionId === selectedSessionId) || [];

  return (
    <PageContainer maxWidth="wide" className={selectedSuggestions.size > 0 || (activeTab === "history" && selectedHistoryActions.size > 0) ? "pb-28" : ""}>
      <PageHeader
        title="Grow Your Network"
        description="Discover active SoundCloud users likely to follow you back, engage with their tracks, and reverse campaigns anytime."
      />

      {notice && (
        <InlineAlert
          variant={notice.type}
          className="mb-6"
          onDismiss={() => setNotice(null)}
        >
          {notice.text}
        </InlineAlert>
      )}

      {/* Tabs Selector */}
      <div className="flex bg-secondary/20 p-1 rounded-lg border-2 border-border/50 self-start mb-6 w-fit">
        <button
          onClick={() => {
            setActiveTab("discover");
            setNotice(null);
          }}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
            activeTab === "discover"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Discover Suggestions
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab("history");
            setNotice(null);
            refetchHistory();
            refetchStats();
          }}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
            activeTab === "history"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Campaign History
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab("analytics");
            setNotice(null);
          }}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
            activeTab === "analytics"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </div>
        </button>
      </div>

      {/* Daily budget / cooldown banner */}
      {budget && activeTab === "discover" && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/60 bg-secondary/20 px-4 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-primary" />
            Daily follow budget
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{budget.remaining}</span> of {budget.dailyCap} left
          </span>
          {budget.cooldownRemainingMs > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              Cooldown: {Math.ceil(budget.cooldownRemainingMs / 60000)} min until next batch
            </span>
          )}
          <span className="ml-auto text-muted-foreground/80">
            Caps protect your account from spam flags.
          </span>
        </div>
      )}

      {/* Discover Tab */}
      {activeTab === "discover" && (
        <>
          {/* STEP 1: Select Seeds */}
          {discoveryStep === 1 && (
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-foreground">1. Select Inspiration Users</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Select 1–5 users you follow to scan their networks. We'll find people who follow them and similar artists.
                </p>
              </div>

              {/* Crawl strategy and search */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchInspirations}
                    onChange={(e) => setSearchInspirations(e.target.value)}
                    placeholder="Search your followings..."
                    className="pl-9 h-10 bg-secondary/20 border-border"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Strategy:</span>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as 'followers' | 'followings' | 'both')}
                    className="h-10 px-3 border-2 border-border rounded-lg text-sm text-foreground bg-secondary/20 focus:border-primary focus:outline-none"
                  >
                    <option value="followers">Scan Their Followers</option>
                    <option value="followings">Scan Their Followings</option>
                    <option value="both">Scan Both</option>
                  </select>
                </div>
              </div>

              <div className="text-sm text-muted-foreground mb-3 flex justify-between items-center">
                <span>{selectedInspirations.size} of 5 selected</span>
                {selectedInspirations.size > 0 && (
                  <button 
                    onClick={() => setSelectedInspirations(new Set())}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {/* Grid lists */}
              <ProgressiveBlur
                className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto"
                active={filteredInspirations.length > 9}
                fadeHeight={72}
              >
                {filteredInspirations.map((user) => {
                  const isSelected = selectedInspirations.has(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleInspirationClick(user.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all border-2 cursor-pointer ${
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : "bg-secondary/20 border-transparent hover:border-border"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
                        isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border"
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <img
                        src={user.avatar_url || "/SC Toolkit Icon.png"}
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate text-foreground">{user.username}</div>
                        <div className="text-xs text-muted-foreground truncate">{formatNumber(user.followers_count)} followers</div>
                      </div>
                    </div>
                  );
                })}
              </ProgressiveBlur>

              {/* Start Discovery Trigger */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => discoverMutation.mutate({ 
                    inspirationUserIds: Array.from(selectedInspirations), 
                    strategy 
                  })}
                  disabled={selectedInspirations.size === 0 || discoverMutation.isPending}
                  className="gap-2 h-11 px-6 shadow-glow-sm"
                >
                  {discoverMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Scan Networks & Discover
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 2: Loading scanning state */}
          {discoveryStep === 2 && (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping duration-1000" />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground">Scanning Networks</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Crawling followers and related artists for your selected seed users. We're filtering out accounts you already follow and scoring them based on engagement likelihood.
              </p>
              <div className="mt-6 text-xs text-primary font-mono animate-pulse">
                Connecting to SoundCloud API & scoring candidates...
              </div>
            </Card>
          )}

          {/* STEP 3: Suggestions List */}
          {discoveryStep === 3 && (
            <>
              <Card className="p-6 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Discovery Results</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Scanned {discoveryStats?.candidatesScanned} profiles → found {discoveryStats?.afterDedup} new candidates, scored by scene fit.
                    </p>
                    {discoveryStats?.seedGenres && discoveryStats.seedGenres.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Scene:</span>
                        {discoveryStats.seedGenres.slice(0, 6).map((g) => (
                          <span key={g} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setDiscoveryStep(1)}>
                      Back / Adjust Seeds
                    </Button>
                    <button
                      onClick={toggleAllSuggestions}
                      className="text-sm text-primary font-medium hover:underline px-2"
                    >
                      {selectedSuggestions.size === suggestions.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                </div>

                {/* Opt-in auto-like (off by default — halves write volume) */}
                <label className="mb-4 flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={likeTracks}
                    onChange={(e) => setLikeTracks(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span className="text-xs leading-5 text-muted-foreground">
                    <span className="font-semibold text-foreground">Also like each user&apos;s top track</span> when following.
                    Off by default — following alone is a lighter footprint and less likely to trip spam filters.
                  </span>
                </label>

                {suggestions.length === 0 ? (
                  <EmptyState
                    icon={<Info className="w-12 h-12" />}
                    title="No suggestions found"
                    description="Try selecting different inspiration users or strategy."
                  />
                ) : (
                  <ProgressiveBlur
                    className="grid md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1"
                    active={suggestions.length > 6}
                    fadeHeight={72}
                  >
                    {suggestions.map((sug) => {
                      const isSelected = selectedSuggestions.has(sug.user.id);
                      return (
                        <div
                          key={sug.user.id}
                          className={`flex flex-col p-4 rounded-xl border-2 transition-all relative ${
                            isSelected
                              ? "bg-primary/5 border-primary/30 shadow-sm"
                              : "bg-secondary/20 border-transparent hover:border-border"
                          }`}
                          onClick={() => toggleSuggestion(sug.user.id)}
                          role="button"
                        >
                          {/* Upper user info */}
                          <div className="flex items-start gap-3 mb-3">
                            <img
                              src={sug.user.avatar_url || "/SC Toolkit Icon.png"}
                              alt={sug.user.username}
                              className="w-12 h-12 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground truncate">{sug.user.username}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase select-none ${
                                  sug.scoreLabel === 'high' 
                                    ? 'bg-orange-500 text-white' 
                                    : sug.scoreLabel === 'medium'
                                    ? 'bg-amber-400 text-black'
                                    : 'bg-secondary text-muted-foreground'
                                }`}>
                                  {sug.scoreLabel === 'high' ? '🔥 High' : sug.scoreLabel === 'medium' ? '⚡ Med' : '🌱 Low'} ({sug.score}%)
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground flex gap-x-2 mt-0.5">
                                <span>{formatNumber(sug.user.followers_count)} followers</span>
                                <span>•</span>
                                <span>Ratio: {sug.signals.followBackRatio}</span>
                              </div>
                            </div>
                            <a
                              href={sug.user.permalink_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-primary shrink-0"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>

                          {/* Seed reason */}
                          <div className="text-[11px] bg-secondary/40 px-2.5 py-1 rounded-md text-muted-foreground mb-3">
                            {sug.signals.isRelatedArtist ? "SoundCloud Related Artist" : "Discovered in seeds' follower network"}
                          </div>

                          {/* Suggested track to like */}
                          {sug.suggestedTrack ? (
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="flex items-center gap-3 p-2 bg-card rounded-lg border border-border/50 text-xs mt-auto"
                            >
                              <img
                                src={sug.suggestedTrack.artwork_url || "/SC Toolkit Icon.png"}
                                alt={sug.suggestedTrack.title}
                                className="w-10 h-10 rounded object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground truncate">{sug.suggestedTrack.title}</div>
                                <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Heart className="w-3 h-3 text-primary fill-primary" />
                                  <span>{formatNumber(sug.suggestedTrack.likes_count)} likes</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                aria-label={`Preview ${sug.suggestedTrack.title} on SoundCloud`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  previewTrack(sug.suggestedTrack!);
                                }}
                                className="text-primary hover:opacity-80 shrink-0 p-1"
                              >
                                <Play className="w-4 h-4 fill-primary text-primary" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic mt-auto">No tracks uploaded</div>
                          )}
                        </div>
                      );
                    })}
                  </ProgressiveBlur>
                )}
              </Card>

              {/* Live batch progress */}
              {job && job.status === "running" && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur">
                  <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:px-6">
                    <div className="flex items-center justify-between gap-4">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Following {job.current} of {job.total}
                        {job.likeTracks && ` · liked ${job.liked}`}
                      </span>
                      <Button variant="outline" size="sm" onClick={cancelEngagement}>
                        Stop
                      </Button>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${job.total ? (job.current / job.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom selection banner */}
              {(!job || job.status !== "running") && (
                <SelectionBanner
                  count={selectedSuggestions.size}
                  entityName="user"
                  actionLabel={likeTracks ? "Follow + like selected" : "Follow selected"}
                  onAction={handleEngageClick}
                  actionIcon={<UserPlus className="w-4 h-4" />}
                />
              )}
            </>
          )}

          {/* STEP 4: Success confirmation summary */}
          {discoveryStep === 4 && (
            <Card className="p-8 text-center max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4 border border-green-200">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Campaign Initiated!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                We've successfully processed your selected engagement actions.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-secondary/20 rounded-xl">
                <div>
                  <div className="text-2xl font-bold text-primary">{recentEngagedCount.followed}</div>
                  <div className="text-xs text-muted-foreground font-semibold uppercase mt-0.5">Users Followed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{recentEngagedCount.liked}</div>
                  <div className="text-xs text-muted-foreground font-semibold uppercase mt-0.5">Tracks Liked</div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setActiveTab("history");
                    refetchHistory();
                    refetchStats();
                  }}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  View Campaign History
                </Button>
                <Button 
                  onClick={() => {
                    setSelectedInspirations(new Set());
                    setDiscoveryStep(1);
                  }}
                  className="gap-2 shadow-glow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Discover Again
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <>
          {/* Dashboard Stats Panel */}
          {statsData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Followed</span>
                <span className="text-2xl font-bold mt-1 text-foreground">{statsData.totalFollowed}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Liked</span>
                <span className="text-2xl font-bold mt-1 text-foreground">{statsData.totalLiked}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Followback Rate</span>
                <span className="text-2xl font-bold mt-1 text-primary">
                  {Math.round(statsData.followedBackRate * 100)}%
                </span>
              </Card>
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Follows</span>
                <span className="text-2xl font-bold mt-1 text-foreground">{statsData.activeFollows}</span>
              </Card>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left sidebar: Sessions selection */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
                  <h4 className="text-sm font-bold text-foreground">Discovery Sessions</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => checkFollowbacksMutation.mutate(null)}
                    disabled={checkingFollowbacks || historyData?.actions.length === 0}
                  >
                    {checkingFollowbacks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1.5 hidden sm:inline">Check All</span>
                  </Button>
                </div>

                {!historyData || historyData.sessions.length === 0 ? (
                  <EmptyState
                    icon={<Clock className="w-8 h-8" />}
                    title="No sessions logged"
                    description="Completed campaigns will appear here."
                  />
                ) : (
                  <div className="space-y-2 max-h-[450px] overflow-y-auto">
                    {historyData.sessions.map((sess) => {
                      const isActive = selectedSessionId === sess.sessionId;
                      const followbackPercent = sess.totalActions > 0 
                        ? Math.round((sess.followedBack / sess.totalActions) * 100) 
                        : 0;

                      return (
                        <div
                          key={sess.sessionId}
                          onClick={() => {
                            setSelectedSessionId(sess.sessionId);
                            setSelectedHistoryActions(new Set());
                          }}
                          className={`p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                            isActive
                              ? "bg-primary/5 border-primary/30"
                              : "bg-secondary/20 border-transparent hover:border-border"
                          }`}
                        >
                          <div className="font-bold text-xs text-foreground line-clamp-1">{sess.label}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(sess.date).toLocaleDateString()}
                          </div>
                          
                          <div className="flex justify-between items-center text-[10px] mt-2.5 pt-2 border-t border-border/40 text-muted-foreground">
                            <span>{sess.totalActions} actions</span>
                            <span className="font-semibold text-primary">
                              {followbackPercent}% followback
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Right content: Actions list in session */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                {!selectedSessionId ? (
                  <EmptyState
                    icon={<ChevronRight className="w-12 h-12" />}
                    title="Select a session"
                    description="Select a discovery campaign session from the list to manage its followers and track history."
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4 mb-4">
                      <div>
                        <h4 className="text-md font-bold text-foreground">{selectedSession?.label}</h4>
                        <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                          <span>Followed back: {selectedSession?.followedBack}</span>
                          <span>•</span>
                          <span>Pending check: {selectedSession?.unchecked}</span>
                          <span>•</span>
                          <span>Reversed: {selectedSession?.reversed}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportSessionCsv(selectedSession?.label || "session", sessionActions)}
                          disabled={sessionActions.length === 0}
                          className="gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => checkFollowbacksMutation.mutate(selectedSessionId)}
                          disabled={checkingFollowbacks}
                          className="gap-1.5"
                        >
                          {checkingFollowbacks ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Check Followbacks
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Select only follow actions that haven't followed back and aren't reversed
                            const targets = sessionActions
                              .filter(a => a.actionType === 'follow' && a.followedBack === false && !a.reversed)
                              .map(a => a.id);
                            if (targets.length === 0) {
                              setNotice({ type: "info", text: "No non-reciprocating users to unfollow." });
                              return;
                            }
                            setSelectedHistoryActions(new Set(targets));
                            setShowReverseConfirm(true);
                          }}
                          className="text-red-500 hover:text-red-600 border-red-200 hover:border-red-300 gap-1.5 bg-red-50/50 dark:bg-red-950/20"
                        >
                          Unfollow Non-Followbacks
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                      <button 
                        onClick={() => selectAllHistoryActions(sessionActions)}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        {selectedHistoryActions.size === sessionActions.length ? "Deselect All" : "Select All"}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {sessionActions.length} actions in session
                      </span>
                    </div>

                    {/* Action Cards */}
                    <ProgressiveBlur
                      className="grid sm:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto"
                      active={sessionActions.length > 6}
                      fadeHeight={72}
                    >
                      {sessionActions.map((act) => {
                        const isSelected = selectedHistoryActions.has(act.id);
                        return (
                          <div
                            key={act.id}
                            onClick={() => toggleHistoryAction(act.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? "bg-primary/5 border-primary/30"
                                : "bg-secondary/20 border-transparent hover:border-border"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
                              isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border"
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>

                            <img
                              src={act.targetAvatar || "/SC Toolkit Icon.png"}
                              alt={act.targetName || "Target"}
                              className={`w-10 h-10 object-cover shrink-0 ${act.actionType === 'follow' ? 'rounded-full' : 'rounded-lg'}`}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs text-foreground truncate">{act.targetName}</div>
                              <div className="text-[10px] text-muted-foreground flex gap-1.5 mt-0.5 flex-wrap items-center">
                                <span className="font-semibold uppercase tracking-wider text-[8px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                                  {act.actionType}
                                </span>
                                
                                {act.reversed ? (
                                  <span className="text-amber-500 font-semibold flex items-center gap-0.5">
                                    <Undo2 className="w-3 h-3" /> Reversed
                                  </span>
                                ) : act.actionType === 'follow' && (
                                  <>
                                    {act.followedBack === true && (
                                      <span className="text-green-600 dark:text-green-400 font-bold">✓ Follows Back</span>
                                    )}
                                    {act.followedBack === false && (
                                      <span className="text-red-500 font-semibold">✗ No Followback</span>
                                    )}
                                    {act.followedBack === null && (
                                      <span className="text-muted-foreground">⏳ Unchecked</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </ProgressiveBlur>
                  </>
                )}
              </Card>
            </div>
          </div>

          {/* Bottom history selection banner */}
          <SelectionBanner
            count={selectedHistoryActions.size}
            entityName="action"
            actionLabel={reversing ? "Undoing..." : "Undo/Reverse Selected"}
            onAction={() => setShowReverseConfirm(true)}
            disabled={reversing}
            actionVariant="destructive"
            actionIcon={reversing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
          />

          {/* Reversal Confirmation Modal */}
          <ConfirmDialog
            open={showReverseConfirm}
            title="Reverse selected actions?"
            description={`This will unfollow the selected users and/or unlike the selected tracks. This takes a few seconds.`}
            confirmLabel="Confirm Undo"
            variant="destructive"
            onConfirm={() => reverseMutation.mutate({ actionIds: Array.from(selectedHistoryActions) })}
            onCancel={() => setShowReverseConfirm(false)}
          >
            <BulkReviewDetails
              action="reversing"
              warning="Unfollows user profiles and unlikes tracks. It will update database history log."
              items={sessionActions
                .filter(a => selectedHistoryActions.has(a.id))
                .map(a => ({
                  id: a.id,
                  label: a.targetName || 'Action',
                  meta: `${a.actionType.toUpperCase()} action`,
                }))}
            />
          </ConfirmDialog>
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <>
          {statsData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Followed</span>
                <span className="text-2xl font-bold mt-1 text-foreground">{statsData.totalFollowed}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Followback Rate</span>
                <span className="text-2xl font-bold mt-1 text-primary">{Math.round(statsData.followedBackRate * 100)}%</span>
              </Card>
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Follows</span>
                <span className="text-2xl font-bold mt-1 text-foreground">{statsData.activeFollows}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending Check</span>
                <span className="text-2xl font-bold mt-1 text-foreground">{statsData.uncheckedFollows}</span>
              </Card>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Per-seed conversion */}
            <Card className="p-6">
              <h4 className="text-sm font-bold text-foreground mb-1">Which seeds convert best</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Follow-back rate of people discovered from each inspiration artist. Seed your next campaign from the winners.
              </p>
              {!analytics || analytics.perSeed.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 className="w-10 h-10" />}
                  title="Not enough data yet"
                  description="Run a campaign and check follow-backs to see which seeds convert."
                />
              ) : (
                <div className="space-y-3">
                  {analytics.perSeed.slice(0, 12).map((seed) => (
                    <div key={seed.seedId} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate">{seed.name}</div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${seed.rate === null ? 0 : Math.round(seed.rate * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right text-[11px] text-muted-foreground shrink-0">
                        {seed.rate === null ? (
                          <span>{seed.follows} follows</span>
                        ) : (
                          <span className="font-semibold text-foreground">
                            {Math.round(seed.rate * 100)}%
                          </span>
                        )}
                        <span className="ml-1">({seed.checked}/{seed.follows})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Follow-back timing */}
            <Card className="p-6">
              <h4 className="text-sm font-bold text-foreground mb-1">When people follow back</h4>
              <p className="text-xs text-muted-foreground mb-4">
                How long after a follow reciprocation was confirmed — helps you time your follow-back checks.
              </p>
              {!analytics || analytics.followBackCurve.every((b) => b.followedBack + b.notFollowedBack === 0) ? (
                <EmptyState
                  icon={<Clock className="w-10 h-10" />}
                  title="No confirmed follow-backs yet"
                  description="Check follow-backs on a campaign to populate this."
                />
              ) : (
                <div className="space-y-4">
                  {analytics.followBackCurve.map((b) => {
                    const total = b.followedBack + b.notFollowedBack;
                    const pct = total > 0 ? Math.round((b.followedBack / total) * 100) : 0;
                    return (
                      <div key={b.bucket}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground font-medium">{b.bucket}</span>
                          <span className="text-muted-foreground">{b.followedBack} back / {total} checked</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Risk interstitial (shown once, before first engagement) */}
      <ConfirmDialog
        open={showRiskModal}
        title="Before you follow in bulk"
        description="Bulk following is against SoundCloud's terms if overdone, and aggressive activity can get accounts flagged or limited."
        confirmLabel={`Follow ${selectedSuggestions.size} — I understand`}
        cancelLabel="Not now"
        variant="destructive"
        onConfirm={acknowledgeRiskAndEngage}
        onCancel={() => setShowRiskModal(false)}
      >
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />We cap follows at {budget?.dailyCap ?? 50} per day and pace them automatically.</li>
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />Everything is logged so you can undo any campaign from the History tab.</li>
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />Following real artists in your scene is fine; mass follow/unfollow churn is what gets flagged.</li>
        </ul>
      </ConfirmDialog>
    </PageContainer>
  );
}
