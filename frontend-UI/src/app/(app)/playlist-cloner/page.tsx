"use client";

import { useState, FormEvent, useEffect } from "react";
import { CopyPlus, Check, ArrowRight, Music, Link as LinkIcon, Loader2, Link2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, Input, EmptyState } from "@/components/ui";

const LAST_TOOLS_KEY = "sc-toolkit-last-tools";

interface ClonedPlaylist {
  id?: number | string;
  title?: string;
  permalink_url?: string;
}

export default function PlaylistClonerPage() {
  const [url, setUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Results
  const [resultPlaylists, setResultPlaylists] = useState<ClonedPlaylist[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_TOOLS_KEY);
      let tools = stored ? JSON.parse(stored) : [];
      tools = ["playlist-cloner", ...tools.filter((t: string) => t !== "playlist-cloner")].slice(0, 10);
      localStorage.setItem(LAST_TOOLS_KEY, JSON.stringify(tools));
    } catch {}
  }, []);

  const handleClone = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsCloning(true);
    setError(null);
    setResultPlaylists([]);
    setStats(null);

    try {
      const body: Record<string, string> = { url: url.trim() };
      if (customTitle.trim()) {
        body.title = customTitle.trim();
      }

      const res = await apiFetch("/api/playlists/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to clone playlist");
      }

      setResultPlaylists(data.playlists ? data.playlists : [data.playlist]);
      setStats(data.stats);
      setUrl("");
      setCustomTitle("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#333] dark:text-foreground flex items-center gap-2 mb-2">
          <CopyPlus className="w-6 h-6 text-[#FF5500]" />
          Playlist Cloner
        </h1>
        <p className="text-[#888] dark:text-muted-foreground">
          Paste a public playlist link to clone it into your own account.
        </p>
      </div>

      <Card className="p-6 mb-8">
        <form onSubmit={handleClone} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Original Playlist URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://soundcloud.com/username/sets/playlist-name"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-9 h-11"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">Custom Name (Optional)</label>
              <Input
                type="text"
                placeholder="Leave blank to use 'Clone of [Original Name]'"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!url.trim() || isCloning}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg font-semibold bg-[#FF5500] hover:bg-[#FF3300] text-white disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isCloning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <CopyPlus className="w-4 h-4" />
                Clone Playlist
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            {error}
          </div>
        )}
      </Card>

      {resultPlaylists.length > 0 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            Cloning Complete
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <Music className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tracks Cloned</p>
                <h3 className="text-2xl font-bold">{stats?.totalTracks?.toString() || "0"}</h3>
              </div>
            </Card>
            {Number(stats?.numPlaylistsCreated) > 1 && (
               <Card className="p-4 flex items-center gap-4">
                 <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                   <CopyPlus className="w-6 h-6" />
                 </div>
                 <div>
                   <p className="text-sm font-medium text-muted-foreground">Parts Created</p>
                   <h3 className="text-2xl font-bold">{stats?.numPlaylistsCreated?.toString() || "0"}</h3>
                 </div>
               </Card>
            )}
          </div>

          <div className="space-y-3">
            {resultPlaylists.map((pl, i) => (
              <Card key={pl.id ?? i} className="p-4 flex items-center justify-between border border-green-500/20 bg-green-50/50 dark:bg-green-950/10">
                <div>
                  <div className="font-semibold text-green-800 dark:text-green-400">
                    {pl.title}
                  </div>
                  <div className="text-sm text-green-600/80 dark:text-green-500/80">
                    ID: {pl.id}
                  </div>
                </div>
                {pl.permalink_url && (
                  <a
                    href={pl.permalink_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/60 transition"
                  >
                    Open
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
