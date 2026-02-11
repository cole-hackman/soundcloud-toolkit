"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, ExternalLink, Music, Users, ListMusic, Loader2, X }  from "lucide-react";
import { EmptyState } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface ResolvedResult {
  url: string;
  status: "ok" | "error";
  data?: {
    type: string;
    id: number;
    title?: string;
    username?: string;
    permalink_url?: string;
    artwork_url?: string;
    avatar_url?: string;
    duration_ms?: number;
    track_count?: number;
    user?: { username: string };
    followers_count?: number;
  };
  error?: string;
}

export default function BatchLinkResolverPage() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ResolvedResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleResolve = async () => {
    const urls = input
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (urls.length === 0) return;
    if (urls.length > 50) {
      alert("Maximum 50 URLs at a time");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resolve/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ urls }),
      });
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      } else {
        alert("Batch resolve failed");
      }
    } catch (error) {
      console.error("Batch resolve error:", error);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const successCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  const iconForType = (type?: string) => {
    if (type === "track") return <Music className="w-4 h-4" />;
    if (type === "playlist") return <ListMusic className="w-4 h-4" />;
    if (type === "user") return <Users className="w-4 h-4" />;
    return <Link2 className="w-4 h-4" />;
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-background">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="mb-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333] dark:text-foreground">
            Batch Link Resolver
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Paste up to 50 SoundCloud URLs to resolve them all at once.
          </p>
        </div>

        {/* Input area */}
        <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border mb-6">
          <label className="block text-sm font-medium text-[#333333] dark:text-foreground mb-2">
            SoundCloud URLs (one per line)
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"https://soundcloud.com/artist/track-name\nhttps://soundcloud.com/artist\nhttps://soundcloud.com/artist/sets/playlist-name"}
            rows={8}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-border rounded-xl text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none focus:ring-1 focus:ring-[#FF5500]/30 resize-y font-mono text-sm"
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-[#999999] dark:text-muted-foreground">
              {input.split("\n").filter((l) => l.trim()).length} URLs entered
            </span>
            <button
              onClick={handleResolve}
              disabled={loading || !input.trim()}
              className="px-6 py-2.5 rounded-lg bg-[#FF5500] text-white font-semibold hover:bg-[#E64D00] transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Resolve All
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#333333] dark:text-foreground">Results</h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-600 dark:text-green-400 font-medium">✓ {successCount}</span>
                {errorCount > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-medium">✗ {errorCount}</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-3 rounded-xl ${
                    result.status === "error"
                      ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30"
                      : "bg-gray-50 dark:bg-secondary/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    result.status === "error" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-[#FF5500]/10 text-[#FF5500]"
                  }`}>
                    {result.status === "error" ? <X className="w-4 h-4" /> : iconForType(result.data?.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {result.status === "ok" && result.data ? (
                      <>
                        <div className="font-semibold text-[#333333] dark:text-foreground truncate">
                          {result.data.title || result.data.username}
                        </div>
                        <div className="text-sm text-[#666666] dark:text-muted-foreground truncate">
                          {result.data.type === "track" && (
                            <>{result.data.user?.username} • {formatDuration(result.data.duration_ms || 0)}</>
                          )}
                          {result.data.type === "playlist" && (
                            <>{result.data.user?.username} • {result.data.track_count} tracks</>
                          )}
                          {result.data.type === "user" && (
                            <>{result.data.followers_count?.toLocaleString()} followers</>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-[#333333] dark:text-foreground truncate font-mono">
                          {result.url}
                        </div>
                        <div className="text-sm text-red-600 dark:text-red-400">{result.error}</div>
                      </>
                    )}
                  </div>

                  {result.data?.permalink_url && (
                    <a
                      href={result.data.permalink_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF5500] hover:text-[#E64D00] flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    result.status === "error"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : "bg-[#FF5500]/10 text-[#FF5500]"
                  }`}>
                    {result.data?.type || "error"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && !loading && (
          <div className="bg-white dark:bg-card rounded-2xl p-8 border-2 border-gray-200 dark:border-border text-center">
            <EmptyState
              icon={<Link2 className="w-12 h-12" />}
              title="Paste URLs above to get started"
              description="Each URL will be resolved to show track, playlist, or user details."
            />
          </div>
        )}
      </div>
    </div>
  );
}
