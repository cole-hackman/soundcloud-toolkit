"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, ExternalLink, Music, Users, ListMusic, Loader2, X, Download, Search, RotateCcw, Copy } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { formatCompactNumber, formatDuration, useBatchResolver, type BatchResolveRow } from "@/lib/resolver";

export default function BatchLinkResolverPage() {
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

    await resolve(urls);
  };

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
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#333333] dark:text-foreground">Results</h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-600 dark:text-green-400 font-medium">✓ {summary?.ok ?? 0}</span>
                <span className="text-red-600 dark:text-red-400 font-medium">✗ {summary?.error ?? 0}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-3 mb-4">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "ok" | "error")} className="px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-border bg-white dark:bg-secondary/20 text-sm">
                <option value="all">All status</option>
                <option value="ok">Success only</option>
                <option value="error">Errors only</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "track" | "playlist" | "user")} className="px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-border bg-white dark:bg-secondary/20 text-sm">
                <option value="all">All types</option>
                <option value="track">Track</option>
                <option value="playlist">Playlist</option>
                <option value="user">User</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "status" | "type" | "title")} className="px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-border bg-white dark:bg-secondary/20 text-sm">
                <option value="status">Sort: Status</option>
                <option value="type">Sort: Type</option>
                <option value="title">Sort: Title</option>
              </select>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 rounded-lg border-2 border-gray-200 dark:border-border bg-white dark:bg-secondary/20 text-sm" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => exportResults("csv")} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-secondary/20 text-sm inline-flex items-center gap-2 hover:text-[#FF5500]"><Download className="w-4 h-4" />Export CSV</button>
              <button onClick={() => exportResults("json")} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-secondary/20 text-sm inline-flex items-center gap-2 hover:text-[#FF5500]"><Download className="w-4 h-4" />Export JSON</button>
              <button onClick={copyFailedUrls} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-secondary/20 text-sm inline-flex items-center gap-2 hover:text-[#FF5500]"><Copy className="w-4 h-4" />Copy Failed URLs</button>
              <button onClick={retryFailed} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-secondary/20 text-sm inline-flex items-center gap-2 hover:text-[#FF5500]"><RotateCcw className="w-4 h-4" />Retry Failed</button>
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

function ResultRow({
  result,
  iconForType,
}: {
  result: BatchResolveRow;
  iconForType: (type?: "track" | "playlist" | "user") => ReactNode;
}) {
  return (
    <div
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
              {result.data.type === "user" ? result.data.username : result.data.title}
            </div>
            <div className="text-sm text-[#666666] dark:text-muted-foreground truncate">
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
  );
}
