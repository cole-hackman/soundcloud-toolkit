"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLibraryChat } from "@/lib/useLibraryChat";
import { ToolResultCard } from "@/components/chat/ToolResultCard";
import { Plus, Trash2 } from "lucide-react";

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

export default function LibraryChatPage() {
  const { messages, conversationId, streaming, toolStatus, send, loadConversation, startNew } =
    useLibraryChat();
  const [input, setInput] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();

  const loadSnapshot = async () => {
    const res = await fetch(`${API_BASE}/api/library/snapshot`, { credentials: "include" });
    if (res.ok) setSnapshot(await res.json());
  };

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
  }, [loadConversationList]);

  // Open a conversation when ?c=<id> is set.
  useEffect(() => {
    const c = searchParams?.get("c");
    if (c && c !== conversationId) loadConversation(c);
  }, [searchParams, conversationId, loadConversation]);

  const refresh = async () => {
    await fetch(`${API_BASE}/api/library/sync`, { method: "POST", credentials: "include" });
    loadSnapshot();
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
    if (id === conversationId) {
      router.replace("/library-chat");
    }
    loadConversationList();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    await send(input.trim());
    setInput("");
    loadConversationList();
  };

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/30 p-3 md:flex md:flex-col">
        <button
          onClick={handleNew}
          className="mb-3 flex items-center justify-center gap-1 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {conversations.map((c) => (
            <li
              key={c.id}
              className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent ${
                c.id === conversationId ? "bg-accent" : ""
              }`}
            >
              <button
                onClick={() => router.replace(`/library-chat?c=${c.id}`)}
                className="flex-1 truncate text-left"
                title={c.title || "Untitled"}
              >
                {c.title || "Untitled"}
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
          {!conversations.length && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">No conversations yet.</li>
          )}
        </ul>
      </aside>

      <div className="mx-auto flex h-full max-w-3xl flex-1 flex-col gap-4 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Library Chat</h1>
            <p className="text-sm text-muted-foreground">
              Ask about your likes, playlists, and genres.
            </p>
          </div>
          <button
            onClick={refresh}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Refresh library
          </button>
        </header>

        {snapshot && (
          <p className="text-xs text-muted-foreground">
            {snapshot.status === "syncing"
              ? "Indexing your library…"
              : `Indexed ${snapshot.likeCount} likes${
                  snapshot.likesSyncedAt
                    ? ` · updated ${new Date(snapshot.likesSyncedAt).toLocaleString()}`
                    : ""
                }`}
          </p>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Try: &ldquo;How many liked tracks by Riordan?&rdquo; · &ldquo;List my Tech House
              likes&rdquo; · &ldquo;Which playlists overlap the most?&rdquo;
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
              </span>
              {m.role === "assistant" &&
                m.toolResults?.map((display, j) => <ToolResultCard key={j} display={display} />)}
            </div>
          ))}
          {toolStatus && (
            <div className="text-xs text-muted-foreground">Running {toolStatus.name}…</div>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your library…"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
