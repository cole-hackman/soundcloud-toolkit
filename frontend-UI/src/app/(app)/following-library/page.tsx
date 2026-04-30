"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  ListMusic,
  Music,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  InlineAlert,
  Input,
  PageContainer,
  PageHeader,
  ResultPanel,
  SelectionBanner,
  Skeleton,
  TrackRow,
} from "@/components/ui";

interface Following {
  id: number;
  username: string;
  avatar_url?: string | null;
  permalink_url?: string | null;
  followers_count?: number;
}

interface Track {
  id: number;
  title: string;
  user?: { username?: string | null };
  artwork_url?: string | null;
  duration?: number | null;
  permalink_url?: string | null;
}

interface Playlist {
  id: number;
  title: string;
  user?: { username?: string | null };
  artwork_url?: string | null;
  permalink_url?: string | null;
  track_count?: number | null;
}

interface CreatedPlaylist {
  id?: number | string;
  title?: string;
  permalink_url?: string;
  trackCount?: number;
}

type LibraryTab = "likes" | "playlists" | "liked-playlists";
type AddMode = "new" | "existing";

const TAB_LABELS: Record<LibraryTab, string> = {
  likes: "Liked Tracks",
  playlists: "Playlists",
  "liked-playlists": "Liked Playlists",
};

export default function FollowingLibraryPage() {
  const [followings, setFollowings] = useState<Following[]>([]);
  const [selectedUser, setSelectedUser] = useState<Following | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [activeTab, setActiveTab] = useState<LibraryTab>("likes");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [nextHref, setNextHref] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<number>>(new Set());
  const [playlistName, setPlaylistName] = useState("");
  const [addMode, setAddMode] = useState<AddMode>("new");
  const [targetPlaylist, setTargetPlaylist] = useState<Playlist | null>(null);
  const [ownPlaylists, setOwnPlaylists] = useState<Playlist[]>([]);
  const [loadingOwnPlaylists, setLoadingOwnPlaylists] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [titlePrefix, setTitlePrefix] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [result, setResult] = useState<{
    playlist?: CreatedPlaylist;
    playlists?: CreatedPlaylist[];
    overflowPlaylists?: CreatedPlaylist[];
    totalTracks?: number;
    addedCount?: number;
    stats?: Record<string, unknown>;
    errors?: { id: number; error: string }[];
  } | null>(null);

  useEffect(() => {
    fetchFollowings();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchLibraryPage(activeTab, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, activeTab]);

  useEffect(() => {
    if (addMode === "existing" && ownPlaylists.length === 0) {
      fetchOwnPlaylists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMode]);

  const filteredFollowings = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return followings
      .filter((user) => !query || user.username?.toLowerCase().includes(query))
      .sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  }, [followings, userSearch]);

  const selectedPlaylistItems = useMemo(
    () => playlists.filter((playlist) => selectedPlaylists.has(playlist.id)),
    [playlists, selectedPlaylists],
  );

  const fetchFollowings = async () => {
    setLoadingUsers(true);
    try {
      const response = await apiFetch("/api/followings");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load followings");
      }
      const collection = data.collection || [];
      setFollowings(collection);
      if (collection.length > 0) setSelectedUser(collection[0]);
    } catch (error) {
      console.error("Failed to fetch followings:", error);
      setNotice({ type: "error", text: "Couldn't load the accounts you follow. Try refreshing the page." });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchLibraryPage = async (tab: LibraryTab, reset: boolean) => {
    if (!selectedUser) return;
    if (reset) {
      setLoadingContent(true);
      setTracks([]);
      setPlaylists([]);
      setNextHref(null);
      setSelectedTracks(new Set());
      setSelectedPlaylists(new Set());
      setResult(null);
    } else {
      setLoadingMore(true);
    }
    setNotice(null);

    try {
      const route =
        tab === "likes"
          ? "likes"
          : tab === "playlists"
            ? "playlists"
            : "liked-playlists";
      const cursor = !reset && nextHref ? `&next=${encodeURIComponent(nextHref)}` : "";
      const response = await apiFetch(`/api/followings/${selectedUser.id}/${route}/paged?limit=50${cursor}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load public library");
      }

      if (tab === "likes") {
        setTracks((prev) => (reset ? data.collection || [] : [...prev, ...(data.collection || [])]));
      } else {
        setPlaylists((prev) => (reset ? data.collection || [] : [...prev, ...(data.collection || [])]));
      }
      setNextHref(data.next_href || null);
    } catch (error) {
      console.error("Failed to fetch followed library:", error);
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Couldn't load this user's public library.",
      });
    } finally {
      setLoadingContent(false);
      setLoadingMore(false);
    }
  };

  const fetchOwnPlaylists = async () => {
    setLoadingOwnPlaylists(true);
    try {
      const response = await apiFetch("/api/playlists");
      const data = await response.json().catch(() => ({}));
      if (response.ok) setOwnPlaylists(data.collection || []);
    } catch (error) {
      console.error("Failed to load own playlists:", error);
    } finally {
      setLoadingOwnPlaylists(false);
    }
  };

  const selectUser = (user: Following) => {
    setSelectedUser(user);
    setActiveTab("likes");
    setPlaylistName(`${user.username} Likes`);
    setTitlePrefix(user.username);
  };

  const toggleTrack = (id: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePlaylist = (id: number) => {
    setSelectedPlaylists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectLoadedTracks = () => {
    if (selectedTracks.size === tracks.length) setSelectedTracks(new Set());
    else setSelectedTracks(new Set(tracks.map((track) => track.id)));
  };

  const selectLoadedPlaylists = () => {
    if (selectedPlaylists.size === playlists.length) setSelectedPlaylists(new Set());
    else setSelectedPlaylists(new Set(playlists.map((playlist) => playlist.id)));
  };

  const canCreateFromTracks =
    selectedUser &&
    (addMode === "existing" ? targetPlaylist !== null : playlistName.trim().length > 0);

  const createFromLikes = async (mode: "selected" | "all") => {
    if (!selectedUser || !canCreateFromTracks) return;
    if (mode === "selected" && selectedTracks.size === 0) return;

    setWorking(true);
    setNotice(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { mode };
      if (mode === "selected") body.trackIds = Array.from(selectedTracks);
      if (addMode === "existing" && targetPlaylist) {
        body.targetPlaylistId = targetPlaylist.id;
      } else {
        body.title = playlistName.trim();
      }

      const response = await apiFetch(`/api/followings/${selectedUser.id}/likes/playlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to create playlist");
      }
      setResult(data);
      setNotice({
        type: "success",
        text: addMode === "existing" ? "Tracks added to your playlist." : "Playlist created in your library.",
      });
    } catch (error) {
      console.error("Failed to create from followed likes:", error);
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Couldn't create the playlist." });
    } finally {
      setWorking(false);
    }
  };

  const cloneSelectedPlaylists = async () => {
    if (!selectedUser || selectedPlaylists.size === 0) return;
    setWorking(true);
    setNotice(null);
    setResult(null);
    try {
      const response = await apiFetch(`/api/followings/${selectedUser.id}/playlists/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistIds: Array.from(selectedPlaylists),
          ...(titlePrefix.trim() ? { titlePrefix: titlePrefix.trim() } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to clone playlists");
      }
      setResult(data);
      setNotice({ type: "success", text: "Selected playlists were cloned into your library." });
    } catch (error) {
      console.error("Failed to clone followed playlists:", error);
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Couldn't clone the selected playlists." });
    } finally {
      setWorking(false);
    }
  };

  const formatDuration = (ms?: number | null) => {
    if (!ms) return "";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const activeSelectionCount = activeTab === "likes" ? selectedTracks.size : selectedPlaylists.size;
  const activeSelectionAction = activeTab === "likes" ? () => createFromLikes("selected") : cloneSelectedPlaylists;
  const actionLabel = activeTab === "likes" ? "Create from Selected" : "Clone Selected";
  const actionDisabled = working || (activeTab === "likes" ? !canCreateFromTracks : selectedPlaylists.size === 0);

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="Following Library"
        description="Browse public likes and playlists from people you follow, then save selected tracks or playlists to your own library."
      />

      {notice && (
        <InlineAlert variant={notice.type} className="mb-5" onDismiss={() => setNotice(null)}>
          {notice.text}
        </InlineAlert>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader>
            <div className="flex items-center gap-2 text-base font-semibold text-[#333] dark:text-foreground">
              <Users className="h-4 w-4 text-[#FF5500]" />
              People you follow
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search followings"
                className="pl-9"
              />
            </div>

            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {loadingUsers ? (
                Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)
              ) : filteredFollowings.length === 0 ? (
                <EmptyState icon={<Users className="h-8 w-8" />} title="No followings found" description="Try another search." />
              ) : (
                filteredFollowings.map((user) => {
                  const isActive = selectedUser?.id === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUser(user)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-[#FF5500]/40 bg-orange-50 text-[#333] dark:bg-orange-950/20 dark:text-foreground"
                          : "border-transparent bg-gray-50 hover:border-border dark:bg-secondary/20"
                      }`}
                    >
                      <img
                        src={user.avatar_url || "/SC Toolkit Icon.png"}
                        alt={user.username}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{user.username}</div>
                        {typeof user.followers_count === "number" && (
                          <div className="text-xs text-muted-foreground">
                            {user.followers_count.toLocaleString()} followers
                          </div>
                        )}
                      </div>
                      {isActive && <Check className="h-4 w-4 text-[#FF5500]" />}
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {!selectedUser ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<Users className="h-8 w-8" />}
                  title="Select a followed user"
                  description="Choose someone you follow to browse their public SoundCloud library."
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedUser.avatar_url || "/SC Toolkit Icon.png"}
                      alt={selectedUser.username}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <h2 className="text-lg font-semibold text-[#333] dark:text-foreground">{selectedUser.username}</h2>
                      <p className="text-sm text-muted-foreground">Only public, API-visible tracks and playlists can be copied.</p>
                    </div>
                  </div>
                  {selectedUser.permalink_url && (
                    <a
                      href={selectedUser.permalink_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-surface-hover"
                    >
                      Open on SoundCloud
                    </a>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(TAB_LABELS) as LibraryTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      activeTab === tab
                        ? "border-[#FF5500]/50 bg-orange-50 text-[#FF5500] dark:bg-orange-950/20"
                        : "border-border bg-surface hover:bg-surface-hover"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

              {activeTab === "likes" ? (
                <Card>
                  <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-base font-semibold text-[#333] dark:text-foreground">
                        <Music className="h-4 w-4 text-[#FF5500]" />
                        Public liked tracks
                      </div>
                      <p className="text-sm text-muted-foreground">Select loaded tracks or create from all visible likes.</p>
                    </div>
                    <Button variant="secondary" onClick={selectLoadedTracks} disabled={tracks.length === 0}>
                      {selectedTracks.size === tracks.length && tracks.length > 0 ? "Clear Loaded" : "Select Loaded"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CreatePanel
                      addMode={addMode}
                      setAddMode={setAddMode}
                      playlistName={playlistName}
                      setPlaylistName={setPlaylistName}
                      targetPlaylist={targetPlaylist}
                      setShowPlaylistPicker={setShowPlaylistPicker}
                      canCreate={Boolean(canCreateFromTracks)}
                      working={working}
                      onCreateSelected={() => createFromLikes("selected")}
                      onCreateAll={() => createFromLikes("all")}
                      selectedCount={selectedTracks.size}
                    />

                    {showPlaylistPicker && (
                      <PlaylistPicker
                        playlists={ownPlaylists}
                        loading={loadingOwnPlaylists}
                        selected={targetPlaylist}
                        onSelect={(playlist) => {
                          setTargetPlaylist(playlist);
                          setShowPlaylistPicker(false);
                        }}
                        onClose={() => setShowPlaylistPicker(false)}
                      />
                    )}

                    <ContentListState
                      loading={loadingContent}
                      empty={tracks.length === 0}
                      emptyTitle="No public liked tracks"
                      emptyDescription="This user may keep likes private, or the API may not expose them."
                    >
                      <div className="space-y-2">
                        {tracks.map((track) => (
                          <TrackRow
                            key={track.id}
                            track={{
                              id: track.id,
                              title: track.title,
                              user: track.user,
                              artwork_url: track.artwork_url,
                              subtitle: (
                                <span>
                                  {track.user?.username || "Unknown"}
                                  {formatDuration(track.duration) ? ` / ${formatDuration(track.duration)}` : ""}
                                </span>
                              ),
                            }}
                            isSelected={selectedTracks.has(track.id)}
                            onToggle={() => toggleTrack(track.id)}
                          />
                        ))}
                      </div>
                    </ContentListState>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-base font-semibold text-[#333] dark:text-foreground">
                        <ListMusic className="h-4 w-4 text-[#FF5500]" />
                        {TAB_LABELS[activeTab]}
                      </div>
                      <p className="text-sm text-muted-foreground">Select playlists to clone them into your own account.</p>
                    </div>
                    <Button variant="secondary" onClick={selectLoadedPlaylists} disabled={playlists.length === 0}>
                      {selectedPlaylists.size === playlists.length && playlists.length > 0 ? "Clear Loaded" : "Select Loaded"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold">Title Prefix</label>
                        <Input
                          value={titlePrefix}
                          onChange={(event) => setTitlePrefix(event.target.value)}
                          placeholder="Optional prefix for cloned playlists"
                        />
                      </div>
                      <Button onClick={cloneSelectedPlaylists} disabled={working || selectedPlaylists.size === 0}>
                        {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        Clone Selected
                      </Button>
                    </div>

                    <ContentListState
                      loading={loadingContent}
                      empty={playlists.length === 0}
                      emptyTitle={`No public ${activeTab === "playlists" ? "playlists" : "liked playlists"}`}
                      emptyDescription="This list may be private or unavailable through the API."
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {playlists.map((playlist) => {
                          const isSelected = selectedPlaylists.has(playlist.id);
                          return (
                            <button
                              key={playlist.id}
                              type="button"
                              onClick={() => togglePlaylist(playlist.id)}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                                isSelected
                                  ? "border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20"
                                  : "border-border bg-surface hover:bg-surface-hover"
                              }`}
                            >
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                  isSelected ? "border-[#FF5500] bg-[#FF5500] text-white" : "border-gray-300 text-transparent"
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </div>
                              <img
                                src={playlist.artwork_url || "/SC Toolkit Icon.png"}
                                alt={playlist.title}
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-[#333] dark:text-foreground">{playlist.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {(playlist.track_count || 0).toLocaleString()} tracks
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ContentListState>
                  </CardContent>
                </Card>
              )}

              {nextHref && (
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={() => fetchLibraryPage(activeTab, false)} disabled={loadingMore}>
                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                    Load More
                  </Button>
                </div>
              )}

              {result && <ResultSummary result={result} />}
            </>
          )}
        </div>
      </div>

      <SelectionBanner
        count={activeSelectionCount}
        entityName={activeTab === "likes" ? "track" : "playlist"}
        actionLabel={actionLabel}
        onAction={activeSelectionAction}
        disabled={actionDisabled}
        actionIcon={working ? <Loader2 className="h-4 w-4 animate-spin" /> : activeTab === "likes" ? <Plus className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      />
    </PageContainer>
  );
}

function CreatePanel({
  addMode,
  setAddMode,
  playlistName,
  setPlaylistName,
  targetPlaylist,
  setShowPlaylistPicker,
  canCreate,
  working,
  onCreateSelected,
  onCreateAll,
  selectedCount,
}: {
  addMode: AddMode;
  setAddMode: (mode: AddMode) => void;
  playlistName: string;
  setPlaylistName: (name: string) => void;
  targetPlaylist: Playlist | null;
  setShowPlaylistPicker: (show: boolean) => void;
  canCreate: boolean;
  working: boolean;
  onCreateSelected: () => void;
  onCreateAll: () => void;
  selectedCount: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAddMode("new")}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            addMode === "new" ? "border-[#FF5500]/50 bg-orange-50 text-[#FF5500] dark:bg-orange-950/20" : "border-border"
          }`}
        >
          New playlist
        </button>
        <button
          type="button"
          onClick={() => setAddMode("existing")}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            addMode === "existing" ? "border-[#FF5500]/50 bg-orange-50 text-[#FF5500] dark:bg-orange-950/20" : "border-border"
          }`}
        >
          Add to existing
        </button>
      </div>

      {addMode === "new" ? (
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Playlist Name</label>
          <Input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Playlist name" />
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Target Playlist</label>
          <Button variant="secondary" onClick={() => setShowPlaylistPicker(true)}>
            {targetPlaylist ? targetPlaylist.title : "Choose playlist"}
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onCreateSelected} disabled={working || !canCreate || selectedCount === 0}>
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create from Selected
        </Button>
        <Button variant="secondary" onClick={onCreateAll} disabled={working || !canCreate}>
          Create from All Public Likes
        </Button>
      </div>
    </div>
  );
}

function PlaylistPicker({
  playlists,
  loading,
  selected,
  onSelect,
  onClose,
}: {
  playlists: Playlist[];
  loading: boolean;
  selected: Playlist | null;
  onSelect: (playlist: Playlist) => void;
  onClose: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="font-semibold">Choose target playlist</div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-surface-hover">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => onSelect(playlist)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                  selected?.id === playlist.id ? "border-[#FF5500]/50 bg-orange-50 dark:bg-orange-950/20" : "border-border"
                }`}
              >
                <span className="truncate font-semibold">{playlist.title}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">{playlist.track_count || 0} tracks</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentListState({
  loading,
  empty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
      </div>
    );
  }

  if (empty) {
    return <EmptyState icon={<Music className="h-8 w-8" />} title={emptyTitle} description={emptyDescription} />;
  }

  return <>{children}</>;
}

function ResultSummary({ result }: { result: { playlist?: CreatedPlaylist; playlists?: CreatedPlaylist[]; overflowPlaylists?: CreatedPlaylist[]; totalTracks?: number; addedCount?: number; stats?: Record<string, unknown>; errors?: { id: number; error: string }[] } }) {
  const playlists = result.playlists || (result.playlist ? [result.playlist] : []);
  return (
    <ResultPanel title="Done" tone={result.errors && result.errors.length > 0 ? "neutral" : "success"}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {typeof result.addedCount === "number"
            ? `Added ${result.addedCount} track${result.addedCount === 1 ? "" : "s"} to your playlist.`
            : `Saved ${result.totalTracks || 0} track${(result.totalTracks || 0) === 1 ? "" : "s"} across ${playlists.length || 1} playlist${(playlists.length || 1) === 1 ? "" : "s"}.`}
        </p>

        {playlists.length > 0 && (
          <div className="space-y-2">
            {playlists.map((playlist, index) => (
              <div key={`${playlist.id || index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{playlist.title}</div>
                  {playlist.trackCount != null && <div className="text-xs text-muted-foreground">{playlist.trackCount} tracks</div>}
                </div>
                {playlist.permalink_url && (
                  <a href={playlist.permalink_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#FF5500]">
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {result.errors && result.errors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            {result.errors.length} playlist{result.errors.length === 1 ? "" : "s"} could not be cloned because they were private, unavailable, or empty.
          </div>
        )}
      </div>
    </ResultPanel>
  );
}
