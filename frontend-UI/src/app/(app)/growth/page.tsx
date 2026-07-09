"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { 
  Sparkles, 
  History, 
  Search, 
  Check, 
  Loader2, 
  ExternalLink, 
  UserPlus, 
  ThumbsUp, 
  TrendingUp, 
  RefreshCw, 
  Undo2, 
  X,
  Play,
  Heart,
  ChevronRight,
  Info,
  Clock
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
  LoadingSpinner,
  Input
} from "@/components/ui";
import { ProgressiveBlur } from "@/components/ui/ProgressiveBlur";
import { apiFetch } from "@/lib/api";
import { 
  followingsQueryOptions, 
  invalidateDashboardSummary 
} from "@/lib/queries";

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
}

export default function GrowthPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"discover" | "history">("discover");
  
  // Tab 1: Discover state
  const [selectedInspirations, setSelectedInspirations] = useState<Set<number>>(new Set());
  const [strategy, setStrategy] = useState<'followers' | 'followings' | 'both'>('followers');
  const [discoveryStep, setDiscoveryStep] = useState<1 | 2 | 3 | 4>(1);
  const [searchInspirations, setSearchInspirations] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [discoveryStats, setDiscoveryStats] = useState<DiscoveryStats | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [engageProgress, setEngageProgress] = useState<{ current: number; total: number } | null>(null);
  const [recentEngagedCount, setRecentEngagedCount] = useState({ followed: 0, liked: 0 });

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
    enabled: activeTab === 'history',
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

  // Engage Mutation (Follow + Like)
  const executeEngagement = async () => {
    if (selectedSuggestions.size === 0) return;
    
    setEngageProgress({ current: 0, total: selectedSuggestions.size });
    const selectedList = suggestions.filter(s => selectedSuggestions.has(s.user.id));
    
    // Create a shared session ID and label
    const sessionId = `sess_${Date.now()}`;
    const inspirationNames = followings
      .filter(f => selectedInspirations.has(f.id))
      .map(f => f.username)
      .slice(0, 3)
      .join(", ");
    const sessionLabel = `Seed: ${inspirationNames}${selectedInspirations.size > 3 ? "..." : ""} — ${new Date().toLocaleDateString()}`;
    
    let followedCount = 0;
    let likedCount = 0;

    for (let i = 0; i < selectedList.length; i++) {
      const sug = selectedList[i];
      try {
        const res = await apiFetch("/api/growth/follow-and-engage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: sug.user.id,
            likeTrackId: sug.suggestedTrack?.id,
            targetName: sug.user.username,
            targetAvatar: sug.user.avatar_url,
            targetFollowers: sug.user.followers_count,
            targetFollowings: sug.user.followings_count,
            sessionId,
            sessionLabel,
            inspirationIds: Array.from(selectedInspirations).join(","),
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.followed) followedCount++;
          if (data.liked) likedCount++;
        }
      } catch (err) {
        console.error(`Failed to engage with user ${sug.user.id}`, err);
      }

      setEngageProgress({ current: i + 1, total: selectedList.length });
    }

    setRecentEngagedCount({ followed: followedCount, liked: likedCount });
    setNotice({
      type: "success",
      text: `Successfully followed ${followedCount} users and liked ${likedCount} tracks!`
    });
    
    setEngageProgress(null);
    setDiscoveryStep(4);
    await invalidateDashboardSummary(queryClient);
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
      </div>

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
                      Scanned {discoveryStats?.candidatesScanned} profiles → found {discoveryStats?.afterDedup} new candidates.
                    </p>
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
                              <a
                                href={sug.suggestedTrack.permalink_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:text-primary-hover shrink-0 p-1"
                              >
                                <Play className="w-4 h-4 fill-primary text-primary" />
                              </a>
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

              {/* Bottom selection banner */}
              <SelectionBanner
                count={selectedSuggestions.size}
                entityName="user"
                actionLabel={engageProgress ? `Engaging ${engageProgress.current}/${engageProgress.total}...` : "Follow + Like Selected"}
                onAction={executeEngagement}
                disabled={!!engageProgress}
                actionIcon={engageProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              />
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
    </PageContainer>
  );
}
