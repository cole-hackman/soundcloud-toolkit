"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { Link as LinkIcon, Search, ExternalLink, Copy, Download, ShoppingBag } from "lucide-react";
import { Button, InlineAlert, Input, LoadingSpinner, PageHeader, ResultPanel } from "@/components/ui";
import type { ResolverResource } from "@/lib/resolver";
import { formatCompactNumber, formatDate, formatDuration, parseTagList, useSingleResolver } from "@/lib/resolver";

function LinkResolverContent() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const { loading, error, result, setResult, setError, resolve } = useSingleResolver();

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) setUrl(urlParam);
  }, [searchParams]);

  const resolveLink = async () => {
    setResult(null);
    setError("");
    await resolve(url);
  };

  const copyText = async (value?: string | number | null) => {
    if (value == null) return;
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {}
  };

  const resource = result?.data;
  const meta = result?.meta;
  const tags = resource && (resource.type === "track" || resource.type === "playlist")
    ? parseTagList(resource.tag_list)
    : [];
  const title = resource?.type === "user" ? resource.username || "Unknown user" : resource?.title || "Untitled";
  const artist =
    resource?.type === "track" || resource?.type === "playlist"
      ? resource?.user?.username || resource?.username
      : resource?.username;
  const imageUrl = resource?.type === "user" ? resource.avatar_url : resource?.artwork_url;

  const renderStats = (item: ResolverResource) => {
    if (item.type === "track") {
      return (
        <>
          <StatCard label="Duration" value={formatDuration(item.duration_ms ?? item.duration)} />
          <StatCard label="Plays" value={formatCompactNumber(item.playback_count)} />
          <StatCard label="Likes" value={formatCompactNumber(item.likes_count)} />
          <StatCard label="Reposts" value={formatCompactNumber(item.reposts_count)} />
          <StatCard label="Comments" value={formatCompactNumber(item.comment_count)} />
          <StatCard label="Created" value={formatDate(item.created_at)} />
        </>
      );
    }
    if (item.type === "playlist") {
      return (
        <>
          <StatCard label="Tracks" value={item.track_count?.toString() || "-"} />
          <StatCard label="Likes" value={formatCompactNumber(item.likes_count)} />
          <StatCard label="Reposts" value={formatCompactNumber(item.reposts_count)} />
          <StatCard label="Created" value={formatDate(item.created_at)} />
        </>
      );
    }
    return (
      <>
        <StatCard label="Followers" value={formatCompactNumber(item.followers_count)} />
        <StatCard label="Following" value={formatCompactNumber(item.followings_count)} />
        <StatCard label="Tracks" value={formatCompactNumber(item.track_count)} />
        <StatCard label="Playlists" value={formatCompactNumber(item.playlist_count)} />
        <StatCard label="Likes" value={formatCompactNumber(item.likes_count)} />
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6 max-w-4xl">
        <PageHeader
          title="Link Resolver"
          description="Get detailed information from any SoundCloud URL."
        />

        {/* Input */}
        <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border mb-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999] dark:text-muted-foreground" />
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resolveLink()}
                placeholder="Paste a SoundCloud URL..."
                className="h-12 pl-12 text-base"
              />
            </div>
            <Button
              onClick={resolveLink}
              disabled={!url.trim() || loading}
              className="h-12 px-6"
            >
              {loading ? (
                <LoadingSpinner size="sm" className="border-white" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              Resolve
            </Button>
          </div>
          {error && (
            <InlineAlert variant="error" className="mt-4" onDismiss={() => setError("")}>
              {error}
            </InlineAlert>
          )}
        </div>

        {/* Result */}
        {result && resource && (
          <ResultPanel>
            <div className="flex items-start gap-6">
              <img
                src={imageUrl || "/SC Toolkit Icon.png"}
                alt={title}
                className="w-32 h-32 rounded-xl object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-[#FF5500]/10 text-[#FF5500] rounded-full text-sm font-medium capitalize">
                    {resource.kind}
                  </span>
                  {meta?.cached && (
                    <span className="px-3 py-1 bg-gray-100 dark:bg-secondary/20 text-[#666666] dark:text-muted-foreground rounded-full text-sm">
                      Cached
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-[#333333] dark:text-foreground mb-2">
                  {title}
                </h2>
                {artist && (
                  <p className="text-[#666666] dark:text-muted-foreground mb-4">
                    by {artist}
                  </p>
                )}
                {resource.description && (
                  <p className="text-[#666666] dark:text-muted-foreground text-sm line-clamp-3 mb-4">
                    {resource.description}
                  </p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {renderStats(resource)}
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tags.slice(0, 8).map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 rounded-full bg-[#FF5500]/10 text-[#FF5500]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {resource.permalink_url && (
                    <a
                      href={resource.permalink_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#FF5500] hover:underline"
                    >
                      Open on SoundCloud
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => copyText(resource.permalink_url || meta?.source_url || url)}
                    className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500]"
                  >
                    <Copy className="w-4 h-4" />
                    Copy URL
                  </button>
                  <button
                    onClick={() => copyText(resource.id)}
                    className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500]"
                  >
                    <Copy className="w-4 h-4" />
                    Copy ID
                  </button>
                  {resource.type === "track" && resource.download_url && (
                    <a href={resource.download_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500]">
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  )}
                  {resource.type === "track" && resource.purchase_url && (
                    <a href={resource.purchase_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500]">
                      <ShoppingBag className="w-4 h-4" />
                      {resource.purchase_title || "Purchase"}
                    </a>
                  )}
                </div>
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-border">
                  <div className="mb-2 text-sm font-semibold text-[#333333] dark:text-foreground">
                    Next actions
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resource.type === "playlist" && resource.permalink_url && (
                      <NextLink
                        href={`/playlist-cloner?url=${encodeURIComponent(resource.permalink_url)}`}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] hover:border-[#FF5500] hover:text-[#FF5500] dark:border-border dark:text-foreground"
                      >
                        Clone playlist
                      </NextLink>
                    )}
                    {resource.type === "playlist" && (
                      <NextLink
                        href="/playlist-health-check"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] hover:border-[#FF5500] hover:text-[#FF5500] dark:border-border dark:text-foreground"
                      >
                        Check playlist health
                      </NextLink>
                    )}
                    {resource.type === "track" && (
                      <NextLink
                        href="/downloads"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] hover:border-[#FF5500] hover:text-[#FF5500] dark:border-border dark:text-foreground"
                      >
                        Check download availability
                      </NextLink>
                    )}
                    {resource.type === "track" && (
                      <NextLink
                        href="/likes-to-playlist"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] hover:border-[#FF5500] hover:text-[#FF5500] dark:border-border dark:text-foreground"
                      >
                        Add tracks to playlist
                      </NextLink>
                    )}
                    {resource.type === "user" && resource.permalink_url && (
                      <a
                        href={resource.permalink_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] hover:border-[#FF5500] hover:text-[#FF5500] dark:border-border dark:text-foreground"
                      >
                        Open profile
                      </a>
                    )}
                  </div>
                </div>
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
          </ResultPanel>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 dark:bg-secondary/20 rounded-lg">
      <div className="text-xs text-[#999999] dark:text-muted-foreground">{label}</div>
      <div className="font-semibold text-[#333333] dark:text-foreground">{value}</div>
    </div>
  );
}

export default function LinkResolverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><LoadingSpinner /></div>}>
      <LinkResolverContent />
    </Suspense>
  );
}
