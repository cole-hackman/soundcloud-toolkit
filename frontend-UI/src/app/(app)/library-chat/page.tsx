"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLibraryChat } from "@/lib/useLibraryChat";
import { ToolResultCard } from "@/components/chat/ToolResultCard";
import { PageContainer, PageHeader } from "@/components/ui";
import {
  Plus,
  Trash2,
  RefreshCcw,
  ArrowUp,
  Sparkles,
  MessageSquare,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type Snapshot = {
  status: string;
  likeCount: number;
  likesSyncedAt: string | null;
  stale: boolean;
};

type ConversationListItem = {
  id: string;
  title: string | null;
  updatedAt: string;
};

const EXAMPLE_PROMPTS = [
  "How many liked tracks by Fred again..?",
  "List my Tech House likes from this year.",
  "Which of my playlists overlap the most?",
  "What are my stats?",
  "Make a playlist from my recent DnB likes.",
];

function snapshotTone(s: Snapshot | null): {
  dotClass: string;
  label: string;
  pulse: boolean;
} {
  if (!s) return { dotClass: "bg-muted-foreground/50", label: "Loading…", pulse: false };
  if (s.status === "syncing")
    return { dotClass: "bg-primary", label: `Indexing ${s.likeCount} likes…`, pulse: true };
  if (s.status === "fresh") {
    const when = s.likesSyncedAt ? new Date(s.likesSyncedAt) : null;
    const rel = when ? formatRelative(when) : "just now";
    return {
      dotClass: "bg-emerald-500",
      label: `${s.likeCount.toLocaleString()} likes indexed · ${rel}`,
      pulse: false,
    };
  }
  if (s.status === "error")
    return { dotClass: "bg-destructive", label: "Sync error — try refreshing", pulse: false };
  return { dotClass: "bg-muted-foreground/50", label: "Not indexed yet", pulse: false };
}

function formatRelative(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export default function LibraryChatPage() {
  const { messages, conversationId, streaming, toolStatus, send, loadConversation, startNew } =
    useLibraryChat();
  const [input, setInput] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const loadSnapshot = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/library/snapshot`, { credentials: "include" });
    if (res.ok) setSnapshot(await res.json());
  }, []);

  const loadConversationList = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/chat/conversations`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
    loadConversationList();
  }, [loadSnapshot, loadConversationList]);

  // Poll snapshot while syncing so the indicator updates live.
  useEffect(() => {
    if (snapshot?.status !== "syncing") return;
    const id = setInterval(loadSnapshot, 3000);
    return () => clearInterval(id);
  }, [snapshot?.status, loadSnapshot]);

  useEffect(() => {
    const c = searchParams?.get("c");
    if (c && c !== conversationId) loadConversation(c);
  }, [searchParams, conversationId, loadConversation]);

  const refresh = async () => {
    setSyncing(true);
    await fetch(`${API_BASE}/api/library/sync`, { method: "POST", credentials: "include" });
    await loadSnapshot();
    setSyncing(false);
  };

  const handleNew = async () => {
    const id = await startNew();
    if (id) {
      router.replace(`/library-chat?c=${id}`);
      loadConversationList();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    await fetch(`${API_BASE}/api/chat/conversations/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (id === conversationId) router.replace("/library-chat");
    loadConversationList();
  };

  const submit = async (text: string) => {
    if (!text.trim() || streaming) return;
    await send(text.trim());
    setInput("");
    loadConversationList();
  };

  const tone = snapshotTone(snapshot);

  return (
    <PageContainer>
      <PageHeader
        title="Library Chat"
        description="Ask the toolkit anything about your SoundCloud library — likes, playlists, genres, and more."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ── Conversation sidebar ─────────────────────────────────────── */}
        <aside className="hidden lg:block">
          <button
            onClick={handleNew}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition hover:border-primary/40 hover:bg-surface-hover"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const active = c.id === conversationId;
              return (
                <li key={c.id} className="group relative">
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                    />
                  )}
                  <button
                    onClick={() => router.replace(`/library-chat?c=${c.id}`)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition ${
                      active
                        ? "bg-accent/60 text-foreground"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    }`}
                    title={c.title || "Untitled"}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{c.title || "Untitled chat"}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    aria-label="Delete conversation"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
            {!conversations.length && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                Your conversations will appear here.
              </li>
            )}
          </ul>
        </aside>

        {/* ── Main column ──────────────────────────────────────────────── */}
        <div className="flex min-h-[70vh] flex-col gap-4">
          {/* Snapshot status bar */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="relative inline-flex h-2 w-2">
                {tone.pulse && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full ${tone.dotClass} opacity-75`}
                  />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${tone.dotClass}`} />
              </span>
              <span className="text-muted-foreground">{tone.label}</span>
            </div>
            <button
              onClick={refresh}
              disabled={syncing || snapshot?.status === "syncing"}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              <RefreshCcw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Conversation column */}
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto rounded-xl border border-border bg-card p-6">
            {messages.length === 0 ? (
              <EmptyPromptGrid onPick={(p) => submit(p)} />
            ) : (
              messages.map((m, i) => (
                <ConversationTurn
                  key={i}
                  message={m}
                  streaming={streaming && i === messages.length - 1}
                />
              ))
            )}
            {toolStatus && <ToolStatusPill name={toolStatus.name} />}
          </div>

          {/* Composer */}
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => submit(input)}
            disabled={streaming}
          />
        </div>
      </div>
    </PageContainer>
  );
}

/* ─────────────────────────── sub-components ───────────────────────────── */

function EmptyPromptGrid({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl tracking-tight">Ask your library a question.</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The toolkit pulls from your indexed likes and playlists, so answers are grounded in
          your real SoundCloud data — not guesses.
        </p>
      </div>
      <div className="flex w-full max-w-xl flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationTurn({
  message,
  streaming,
}: {
  message: { role: "user" | "assistant"; content: string; toolResults?: unknown[] };
  streaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-primary/15 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
          {message.content}
        </div>
      </div>
    );
  }
  // assistant: clean left-aligned text with a thin orange accent rail
  return (
    <div className="flex gap-3">
      <span aria-hidden className="mt-1 w-[2px] shrink-0 self-stretch rounded-full bg-primary/70" />
      <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-foreground">
        <div className="whitespace-pre-wrap">
          {message.content}
          {streaming && (
            <span className="ml-0.5 inline-block h-[1em] w-[1px] translate-y-[2px] animate-pulse bg-primary align-middle" />
          )}
        </div>
        {message.toolResults?.map((display, j) => (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <ToolResultCard key={j} display={display as any} />
        ))}
      </div>
    </div>
  );
}

function ToolStatusPill({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 self-start rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      <span>running</span>
      <code className="font-mono text-[11px] tracking-tight">{name}</code>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative flex items-center gap-2 rounded-xl border border-border bg-surface pl-4 pr-1.5 py-1.5 transition focus-within:border-primary/50"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about your library…"
        disabled={disabled}
        className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <kbd className="hidden text-[10px] text-muted-foreground sm:inline">↵</kbd>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </form>
  );
}
