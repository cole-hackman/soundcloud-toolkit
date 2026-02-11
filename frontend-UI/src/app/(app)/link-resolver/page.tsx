"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Link as LinkIcon, Search, ExternalLink } from "lucide-react";
import { LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface ResolvedData {
  kind: string;
  id: number;
  title?: string;
  username?: string;
  description?: string;
  artwork_url?: string;
  avatar_url?: string;
  duration?: number;
  track_count?: number;
  followers_count?: number;
  permalink_url?: string;
  user?: {
    username: string;
    avatar_url: string;
  };
}

function LinkResolverContent() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResolvedData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) setUrl(urlParam);
  }, [searchParams]);

  const resolveLink = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        const err = await response.json();
        setError(err.error || "Failed to resolve link");
      }
    } catch (err) {
      console.error("Error resolving link:", err);
      setError("An error occurred while resolving the link");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-background">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333] dark:text-foreground">
            Link Resolver
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Get detailed information from any SoundCloud URL.
          </p>
        </div>

        {/* Input */}
        <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999] dark:text-muted-foreground" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resolveLink()}
                placeholder="Paste a SoundCloud URL..."
                className="w-full pl-12 pr-4 py-4 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition text-lg bg-transparent text-[#333333] dark:text-foreground"
              />
            </div>
            <button
              onClick={resolveLink}
              disabled={!url.trim() || loading}
              className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? (
                <LoadingSpinner size="sm" className="border-white" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              Resolve
            </button>
          </div>
          {error && (
            <p className="mt-4 text-red-500 text-sm">{error}</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="bg-white dark:bg-card rounded-2xl p-8 border-2 border-gray-200 dark:border-border">
            <div className="flex items-start gap-6">
              <img
                src={
                  result.artwork_url ||
                  result.avatar_url ||
                  "/SC Toolkit Icon.png"
                }
                alt={result.title || result.username}
                className="w-32 h-32 rounded-xl object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-[#FF5500]/10 text-[#FF5500] rounded-full text-sm font-medium capitalize">
                    {result.kind}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-[#333333] dark:text-foreground mb-2">
                  {result.title || result.username}
                </h2>
                {result.user && (
                  <p className="text-[#666666] dark:text-muted-foreground mb-4">
                    by {result.user.username}
                  </p>
                )}
                {result.description && (
                  <p className="text-[#666666] dark:text-muted-foreground text-sm line-clamp-3 mb-4">
                    {result.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-4 mb-4">
                  {result.duration !== undefined && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                      <div className="text-xs text-[#999999] dark:text-muted-foreground">Duration</div>
                      <div className="font-semibold text-[#333333] dark:text-foreground">
                        {formatDuration(result.duration)}
                      </div>
                    </div>
                  )}
                  {result.track_count !== undefined && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                      <div className="text-xs text-[#999999] dark:text-muted-foreground">Tracks</div>
                      <div className="font-semibold text-[#333333] dark:text-foreground">
                        {result.track_count}
                      </div>
                    </div>
                  )}
                  {result.followers_count !== undefined && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                      <div className="text-xs text-[#999999] dark:text-muted-foreground">Followers</div>
                      <div className="font-semibold text-[#333333] dark:text-foreground">
                        {formatNumber(result.followers_count)}
                      </div>
                    </div>
                  )}
                </div>

                {result.permalink_url && (
                  <a
                    href={result.permalink_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#FF5500] hover:underline"
                  >
                    Open on SoundCloud
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Raw Data */}
            <details className="mt-8">
              <summary className="cursor-pointer text-sm text-[#666666] dark:text-muted-foreground hover:text-[#FF5500]">
                View raw data
              </summary>
              <pre className="mt-4 p-4 bg-gray-50 dark:bg-secondary/20 rounded-lg overflow-x-auto text-xs text-[#333333] dark:text-foreground">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LinkResolverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F2F2F2] dark:bg-background flex items-center justify-center"><LoadingSpinner /></div>}>
      <LinkResolverContent />
    </Suspense>
  );
}
