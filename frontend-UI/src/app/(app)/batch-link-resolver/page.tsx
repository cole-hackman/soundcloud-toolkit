"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import NextLink from "next/link";
import { Link2, ExternalLink, Music, Users, ListMusic, Loader2, X, Download, Search, RotateCcw, Copy } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  InlineAlert,
  Input,
  PageContainer,
  PageHeader,
  ResultPanel,
  SectionHeading,
  Select,
  useAnnounce,
} from "@/components/ui";
import { formatCompactNumber, formatDuration, useBatchResolver, type BatchResolveRow } from "@/lib/resolver";

export default function BatchLinkResolverPage() {
  const announce = useAnnounce();
  const [input, setInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "error">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "track" | "playlist" | "user">("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"status" | "type" | "title">("status");
  const { loading, error, result, resolve, setError } = useBatchResolver();

  const handleResolve = async () => {
    const urls = input
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (urls.length === 0) return;
    if (urls.length > 50) {
      setError("Maximum 50 URLs at a time");
      return;
    }

    announce(`Resolving ${urls.length} link${urls.length === 1 ? "" : "s"}…`);
    await resolve(urls);
  };

  // The outcome lands in a panel below the fold with no focus change, so the
  // only thing that ever said "done" was the appearance of some rows.
  useEffect(() => {
    if (loading || !result) return;
    announce(
      `Done: ${result.summary.ok} resolved, ${result.summary.error} failed, of ${result.summary.total}.`,
    );
  }, [loading, result, announce]);

  const results = useMemo(() => result?.results ?? [], [result]);
  const summary = result?.summary;

  const iconForType = (type?: "track" | "playlist" | "user") => {
    if (type === "track") return <Music className="w-4 h-4" />;
    if (type === "playlist") return <ListMusic className="w-4 h-4" />;
    if (type === "user") return <Users className="w-4 h-4" />;
    return <Link2 className="w-4 h-4" />;
  };

  const filteredResults = useMemo(() => {
    let rows = [...results];
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (typeFilter !== "all") rows = rows.filter((r) => r.data?.type === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => {
        const title = (r.data?.type === "user" ? r.data?.username : r.data?.title) || "";
        const artist =
          r.data?.type === "track" || r.data?.type === "playlist"
            ? r.data.user?.username || r.data?.username || ""
            : r.data?.username || "";
        return r.url.toLowerCase().includes(q) || title.toLowerCase().includes(q) || artist.toLowerCase().includes(q);
      });
    }
    rows.sort((a, b) => {
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "type") return (a.data?.type || "").localeCompare(b.data?.type || "");
      const aTitle = (a.data?.type === "user" ? a.data?.username : a.data?.title) || "";
      const bTitle = (b.data?.type === "user" ? b.data?.username : b.data?.title) || "";
      return aTitle.localeCompare(bTitle);
    });
    return rows;
  }, [results, statusFilter, typeFilter, query, sortBy]);

  const copyFailedUrls = async () => {
    const text = results.filter((r) => r.status === "error").map((r) => r.url).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const retryFailed = async () => {
    const failed = results.filter((r) => r.status === "error").map((r) => r.url);
    if (!failed.length) return;
    setInput(failed.join("\n"));
    await resolve(failed);
  };

  const exportResults = (type: "json" | "csv") => {
    const ok = results.filter((r) => r.status === "ok");
    if (!ok.length) return;
    if (type === "json") {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "resolver-results.json";
      a.click();
      URL.revokeObjectURL(href);
      return;
    }
    const lines = [
      "index,status,type,title,artist,url,permalink",
      ...results.map((r) => {
        const title = r.data?.type === "user" ? r.data?.username : r.data?.title;
        const artist =
          r.data?.type === "track" || r.data?.type === "playlist"
            ? r.data.user?.username || r.data?.username || ""
            : r.data?.username || "";
        const cells = [r.index, r.status, r.data?.type || "", title || "", artist, r.url, r.data?.permalink_url || ""];
        return cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "resolver-results.csv";
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <PageContainer maxWidth="narrow">
        <PageHeader
          title="Batch Link Resolver"
          description="Paste up to 50 SoundCloud URLs to resolve them all at once."
        />

        {/* Input area */}
        <Card className="mb-6 p-6">
          <SectionHeading className="mb-3">Links to resolve</SectionHeading>
          <Field
            label="SoundCloud URLs (one per line)"
            hint="Up to 50 at a time."
          >
            {(field) => (
              <textarea
                {...field}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={"https://soundcloud.com/artist/track-name\nhttps://soundcloud.com/artist\nhttps://soundcloud.com/artist/sets/playlist-name"}
                rows={8}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-border rounded-xl text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y font-mono text-base sm:text-sm"
              />
            )}
          </Field>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground-subtle">
              {input.split("\n").filter((l) => l.trim()).length} URLs entered
            </span>
            <Button onClick={handleResolve} disabled={loading || !input.trim()}>
              {loading ? (
                <>
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <Link2 aria-hidden="true" className="w-4 h-4" />
                  Resolve All
                </>
              )}
            </Button>
          </div>
          {error && (
            <InlineAlert variant="error" className="mt-4" onDismiss={() => setError("")}>
              {error}
            </InlineAlert>
          )}
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <ResultPanel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-foreground">Results</h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-success-text font-medium">
                  <span aria-hidden="true">✓ </span>
                  {summary?.ok ?? 0} resolved
                </span>
                <span className="text-destructive-text font-medium">
                  <span aria-hidden="true">✗ </span>
                  {summary?.error ?? 0} failed
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 md:grid-cols-4">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "ok" | "error")}
              >
                <option value="all">All status</option>
                <option value="ok">Success only</option>
                <option value="error">Errors only</option>
              </Select>
              <Select
                label="Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | "track" | "playlist" | "user")}
              >
                <option value="all">All types</option>
                <option value="track">Track</option>
                <option value="playlist">Playlist</option>
                <option value="user">User</option>
              </Select>
              <Select
                label="Sort by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "status" | "type" | "title")}
              >
                <option value="status">Status</option>
                <option value="type">Type</option>
                <option value="title">Title</option>
              </Select>
              <Field label="Search results">
                {(field) => (
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground-subtle"
                    />
                    <Input
                      {...field}
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search..."
                      className="pl-9"
                    />
                  </div>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-2 mb-4 sm:grid-cols-2 lg:flex lg:flex-wrap">
              <Button nowrap variant="secondary" size="sm" onClick={() => exportResults("csv")}>
                <Download aria-hidden="true" className="w-4 h-4" />
                Export CSV
              </Button>
              <Button nowrap variant="secondary" size="sm" onClick={() => exportResults("json")}>
                <Download aria-hidden="true" className="w-4 h-4" />
                Export JSON
              </Button>
              <Button nowrap variant="secondary" size="sm" onClick={copyFailedUrls}>
                <Copy aria-hidden="true" className="w-4 h-4" />
                Copy Failed URLs
              </Button>
              <Button nowrap variant="secondary" size="sm" onClick={retryFailed}>
                <RotateCcw aria-hidden="true" className="w-4 h-4" />
                Retry Failed
              </Button>
            </div>

            <div className="space-y-2">
              {filteredResults.map((result) => (
                <ResultRow
                  key={`${result.index}-${result.url}`}
                  result={result}
                  iconForType={iconForType}
                />
              ))}
            </div>
          </ResultPanel>
        )}

        {results.length === 0 && !loading && (
          <Card className="p-8 text-center">
            <EmptyState
              icon={<Link2 className="w-12 h-12" />}
              title="Paste URLs above to get started"
              description="Each URL will be resolved to show track, playlist, or user details."
            />
          </Card>
        )}
    </PageContainer>
  );
}

function ResultRow({
  result,
  iconForType,
}: {
  result: BatchResolveRow;
  iconForType: (type?: "track" | "playlist" | "user") => ReactNode;
}) {
  const title =
    result.data?.type === "user" ? result.data?.username : result.data?.title;

  return (
    /* Below `sm` the row stacks: the title gets the full width and the
       actions sit under it, instead of three shrink-0 controls squeezing it. */
    <div
      className={`flex flex-col gap-3 p-3 rounded-xl sm:flex-row sm:items-center sm:gap-4 ${
        result.status === "error"
          ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30"
          : "bg-gray-50 dark:bg-secondary/20"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
      <div
        aria-hidden="true"
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          result.status === "error" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-primary/10 text-primary"
        }`}
      >
        {result.status === "error" ? <X className="w-4 h-4" /> : iconForType(result.data?.type)}
      </div>

      <div className="flex-1 min-w-0">
        {result.status === "ok" && result.data ? (
          <>
            <div className="font-semibold text-foreground truncate">
              {result.data.type === "user" ? result.data.username : result.data.title}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {result.data.type === "track" && (
                <>{result.data.user?.username} • {formatDuration(result.data.duration_ms || result.data.duration)}</>
              )}
              {result.data.type === "playlist" && (
                <>{result.data.user?.username} • {result.data.track_count} tracks</>
              )}
              {result.data.type === "user" && (
                <>{formatCompactNumber(result.data.followers_count)} followers</>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-foreground truncate font-mono">
              {result.url}
            </div>
            {/* `--destructive-text` is validated against the page and card
                backgrounds, not against this red-tinted row, where it is
                4.38:1. These are the pairings `InlineAlert variant="error"`
                already uses on the same tint. */}
            <div className="text-sm text-red-900 dark:text-red-100">{result.error}</div>
          </>
        )}
      </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {result.data?.permalink_url && (
          <a
            href={result.data.permalink_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${title || result.url} on SoundCloud`}
            className="touch-44 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-primary hover:bg-accent hover:text-primary-text"
          >
            <ExternalLink aria-hidden="true" className="w-4 h-4" />
          </a>
        )}

        {result.status === "ok" && result.data?.type === "playlist" && result.data.permalink_url && (
          <NextLink
            href={`/playlist-cloner?url=${encodeURIComponent(result.data.permalink_url)}`}
            aria-label={`Clone ${title || "this playlist"}`}
            className="inline-flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Clone
          </NextLink>
        )}

        {result.status === "ok" && result.data?.type === "track" && (
          <NextLink
            href="/downloads"
            aria-label={`Find downloads for ${title || "this track"}`}
            className="inline-flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Downloads
          </NextLink>
        )}

        {/* The type chip used `text-primary-text` on `bg-primary/10`: the
            tint lifts the background to #fae9e3 and the pair lands at 4.27:1.
            A neutral chip keeps the orange for things that are actually
            interactive. */}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 border ${
          result.status === "error"
            ? "border-red-300 bg-red-100 text-red-900 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-100"
            : "border-border bg-secondary/40 text-foreground"
        }`}>
          {result.data?.type || "error"}
        </span>
      </div>
    </div>
  );
}
