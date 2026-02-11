"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, Music, ExternalLink, Heart, ListMusic, Trash2, X, CheckSquare } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
  coverUrl?: string; // Backend computed fallback
  kind?: "playlist";
}

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
  downloadable?: boolean | string;
  download_url?: string;
  purchase_url?: string;
  purchase_title?: string;
  permalink_url: string;
}

const LIKED_TRACKS_PLAYLIST: Playlist = {
  id: -1,
  title: "Liked Tracks",
  track_count: 0,
  artwork_url: "",
  kind: "playlist" // Pseudo-playlist
};

export default function DownloadsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedSource, setSelectedSource] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Fetch playlists on mount
  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.collection || []);
      }
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTracks = async (source: Playlist) => {
    setLoadingTracks(true);
    setTracks([]); // Reset
    try {
      let endpoint = "";
      if (source.id === -1) {
        endpoint = `${API_BASE}/api/likes`; // Or /api/likes/paged if available/needed
      } else {
        endpoint = `${API_BASE}/api/playlists/${source.id}`;
      }

      const response = await fetch(endpoint, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        // Handle different response structures
        if (source.id === -1) {
             setTracks(data.collection || []); // Likes returns collection
        } else {
             setTracks(data.tracks || []); // Playlist returns tracks array
        }
      }
    } catch (error) {
        console.error("Failed to fetch tracks:", error);
    } finally {
        setLoadingTracks(false);
    }
  };

  const handleSelectSource = (p: Playlist) => {
      setSelectedSource(p);
      fetchTracks(p);
      setSelectionMode(false);
      setSelectedTrackIds(new Set());
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedTrackIds(new Set());
  };

  const toggleTrackSelection = (id: number) => {
    const newSelected = new Set(selectedTrackIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTrackIds(newSelected);
  };

  const handleRemoveSelected = async () => {
    if (!selectedSource || selectedSource.id === -1 || selectedTrackIds.size === 0) return;
    
    if (!confirm(`Remove ${selectedTrackIds.size} tracks from "${selectedSource.title}"?`)) return;

    setIsRemoving(true);
    try {
        // Calculate the new track list
        // We need to preserve the order of the remaining tracks
        // The backend expects an array of IDs
        
        // IMPORTANT: We need all tracks for the playlist update, not just downloadable ones
        // But `tracks` state currently holds what we fetched.
        // Assuming `fetchTracks` fetches ALL tracks, not just downloadable (filtering happens in render/variable)
        
        const remainingTracks = tracks.filter(t => !selectedTrackIds.has(t.id));
        const remainingIds = remainingTracks.map(t => t.id);

        const response = await fetch(`${API_BASE}/api/playlists/${selectedSource.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tracks: remainingIds }),
        });

        if (response.ok) {
            // Update local state
            setTracks(remainingTracks);
            setSelectedTrackIds(new Set());
            setSelectionMode(false);
            // Optionally update playlist track count in `playlists` state
            setPlaylists(prev => prev.map(p => 
                p.id === selectedSource.id 
                    ? { ...p, track_count: remainingTracks.length } 
                    : p
            ));
        } else {
            alert("Failed to update playlist. Please try again.");
        }
    } catch (error) {
        console.error("Failed to remove tracks:", error);
        alert("An error occurred while removing tracks.");
    } finally {
        setIsRemoving(false);
    }
  };

  // Filter only downloadable or purchasable tracks
  const downloadableTracks = tracks.filter(t => 
    (Boolean(t.downloadable) || t.downloadable === "true" || !!t.download_url) || !!t.purchase_url
  );

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-background">
        <div className="container mx-auto px-6 py-12 max-w-6xl">
            {/* Header */}
            <div className="mb-12">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-6">
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333] dark:text-foreground">Downloads</h1>
            <p className="text-lg text-[#666666] dark:text-muted-foreground">Find downloadable tracks in your library.</p>
            </div>

            {!selectedSource ? (
                /* Source Selection */
                <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
                    <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">Select Source</h2>
                    {loading ? (
                         <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse" />)}
                         </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Liked Tracks Option */}
                            <button
                                onClick={() => handleSelectSource(LIKED_TRACKS_PLAYLIST)}
                                className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-[#FF5500] transition-all text-left"
                            >
                                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white">
                                    <Heart className="w-8 h-8" fill="currentColor" />
                                </div>
                                <div>
                                    <div className="font-semibold text-[#333333] dark:text-foreground">Liked Tracks</div>
                                    <div className="text-sm text-[#666666] dark:text-muted-foreground">All your likes</div>
                                </div>
                            </button>

                            {playlists.map((playlist) => (
                                <button
                                    key={playlist.id}
                                    onClick={() => handleSelectSource(playlist)}
                                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-[#FF5500] transition-all text-left"
                                >
                                    <img
                                        src={playlist.coverUrl || playlist.artwork_url || "/SC Toolkit Icon.png"}
                                        alt={playlist.title}
                                        className="w-16 h-16 rounded-lg object-cover"
                                    />
                                    <div>
                                        <div className="font-semibold text-[#333333] dark:text-foreground">{playlist.title}</div>
                                        <div className="text-sm text-[#666666] dark:text-muted-foreground">{playlist.track_count} tracks</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* Track List */
                <div>
                     <button
                        onClick={() => { setSelectedSource(null); setTracks([]); }}
                        className="text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-4 flex items-center gap-2"
                     >
                        ← Back to sources
                    </button>
                    
                    <h2 className="text-2xl font-bold text-[#333333] dark:text-foreground mb-6 flex items-center gap-3">
                        {selectedSource.id === -1 ? <Heart className="w-6 h-6 text-[#FF5500]" fill="currentColor"/> : <ListMusic className="w-6 h-6" />}
                        {selectedSource.title}
                        <span className="text-lg font-normal text-[#666666] dark:text-muted-foreground ml-2">({downloadableTracks.length} downloadable)</span>
                    </h2>
                    
                    {/* Toolbar */}
                    {selectedSource.id !== -1 && downloadableTracks.length > 0 && (
                        <div className="flex items-center gap-4 mb-6">
                            {!selectionMode ? (
                                <button
                                    onClick={toggleSelectionMode}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#666666] dark:text-muted-foreground bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-accent transition"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Select to Remove
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={toggleSelectionMode}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#666666] dark:text-muted-foreground bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-accent transition"
                                    >
                                        <X className="w-4 h-4" />
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRemoveSelected}
                                        disabled={selectedTrackIds.size === 0 || isRemoving}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isRemoving ? <LoadingSpinner className="w-4 h-4 text-white" /> : <Trash2 className="w-4 h-4" />}
                                        Remove ({selectedTrackIds.size})
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
                        {loadingTracks ? (
                             <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse" />)}
                             </div>
                        ) : downloadableTracks.length === 0 ? (
                            <EmptyState
                                icon={<Download className="w-12 h-12" />}
                                title="No downloadable tracks found"
                                description="Try another playlist or source."
                            />
                        ) : (
                            <div className="space-y-2">
                                {downloadableTracks.map((track, index) => (
                                    <div key={track.id} className={`flex items-center gap-4 p-3 rounded-xl transition-colors group ${selectedTrackIds.has(track.id) ? "bg-orange-50 dark:bg-orange-900/20" : "bg-gray-50 dark:bg-secondary/20 hover:bg-gray-100 dark:hover:bg-secondary/40"}`}>
                                         {selectionMode && (
                                            <div className="pl-1 pr-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTrackIds.has(track.id)}
                                                    onChange={() => toggleTrackSelection(track.id)}
                                                    className="w-5 h-5 rounded border-gray-300 text-[#FF5500] focus:ring-[#FF5500]"
                                                />
                                            </div>
                                         )}
                                         {!selectionMode && <span className="w-8 text-center text-sm text-[#999999] dark:text-muted-foreground">{index + 1}</span>}
                                         
                                         <img src={track.artwork_url || "/SC Toolkit Icon.png"} alt={track.title} className="w-12 h-12 rounded-lg object-cover" />
                                         <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-[#333333] dark:text-foreground truncate flex items-center gap-2">
                                                {track.title}
                                                {/* Labels */}
                                                {(Boolean(track.downloadable) || track.downloadable === "true" || !!track.download_url) && (
                                                    <a
                                                        href={track.download_url ? `${API_BASE}/api/proxy-download?url=${encodeURIComponent(track.download_url)}` : track.permalink_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50"
                                                        title={track.download_url ? "Direct Download" : "Visit page to download"}
                                                    >
                                                        <Download className="w-3 h-3" /> DL
                                                    </a>
                                                )}
                                            </div>
                                            <div className="text-sm text-[#666666] dark:text-muted-foreground truncate">
                                                {track.user?.username} • {formatDuration(track.duration)}
                                            </div>
                                         </div>
                                         {/* Action Button */}
                                         <div className="flex gap-2">
                                            <a 
                                                href={track.download_url ? `${API_BASE}/api/proxy-download?url=${encodeURIComponent(track.download_url)}` : (track.purchase_url || track.permalink_url)} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className={`p-2 rounded-lg transition text-white ${
                                                    track.download_url 
                                                        ? "bg-green-500 hover:bg-green-600" 
                                                        : "bg-[#FF5500] hover:bg-[#E64D00]"
                                                }`}
                                                title={track.download_url ? "Download directly" : (track.purchase_url ? "Go to download/buy" : "Go to track")}
                                            >
                                                <Download className="w-5 h-5" />
                                            </a>
                                         </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
