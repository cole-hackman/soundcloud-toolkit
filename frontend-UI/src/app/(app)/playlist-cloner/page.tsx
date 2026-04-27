"use client";

import { useEffect, useState, FormEvent } from "react";
import { CopyPlus, ArrowRight, Music, Link as LinkIcon, Loader2, Link2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, InlineAlert, Input, PageHeader, ResultPanel } from "@/components/ui";

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
    const params = new URLSearchParams(window.location.search);
    const initialUrl = params.get("url");
    if (initialUrl) setUrl(initialUrl);
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-6 py-6">
      <PageHeader
        title="Playlist Cloner"
        description="Paste a public playlist link to clone it into your own account."
      />

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2 text-base font-semibold text-[#333] dark:text-foreground">
            <Link2 className="h-4 w-4 text-[#FF5500]" />
            Clone a public playlist
          </div>
        </CardHeader>
        <CardContent>
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
                  className="h-10 pl-9"
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
                className="h-10"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!url.trim() || isCloning}
            className="h-10 w-full px-4 sm:w-auto"
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
          </Button>
        </form>

        {error && (
          <InlineAlert variant="error" className="mt-4" onDismiss={() => setError(null)}>
            {error}
          </InlineAlert>
        )}
        </CardContent>
      </Card>

      {resultPlaylists.length > 0 && (
        <ResultPanel
          title="Cloning Complete"
          tone="success"
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                  <Music className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tracks Cloned</p>
                  <h3 className="text-2xl font-bold text-[#333] dark:text-foreground">{stats?.totalTracks?.toString() || "0"}</h3>
                </div>
              </Card>
              {Number(stats?.numPlaylistsCreated) > 1 && (
                <Card className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                    <CopyPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Parts Created</p>
                    <h3 className="text-2xl font-bold text-[#333] dark:text-foreground">{stats?.numPlaylistsCreated?.toString() || "0"}</h3>
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-3">
              {resultPlaylists.map((pl, i) => (
                <Card key={pl.id ?? i} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[#333] dark:text-foreground">
                        {pl.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ID: {pl.id}
                      </div>
                    </div>
                    {pl.permalink_url && (
                      <a
                        href={pl.permalink_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border/70 bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-surface-hover"
                      >
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </ResultPanel>
      )}
      </div>
    </div>
  );
}
