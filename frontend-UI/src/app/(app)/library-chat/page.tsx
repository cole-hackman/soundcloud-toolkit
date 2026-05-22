"use client";

import { useEffect, useState } from "react";
import { useLibraryChat } from "@/lib/useLibraryChat";
import { ToolResultCard } from "@/components/chat/ToolResultCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type Snapshot = {
  status: string;
  likeCount: number;
  likesSyncedAt: string | null;
  stale: boolean;
};

export default function LibraryChatPage() {
  const { messages, streaming, toolStatus, send } = useLibraryChat();
  const [input, setInput] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const loadSnapshot = async () => {
    const res = await fetch(`${API_BASE}/api/library/snapshot`, { credentials: "include" });
    if (res.ok) setSnapshot(await res.json());
  };
  useEffect(() => {
    loadSnapshot();
  }, []);

  const refresh = async () => {
    await fetch(`${API_BASE}/api/library/sync`, { method: "POST", credentials: "include" });
    loadSnapshot();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    send(input.trim());
    setInput("");
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-6">
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
            {m.role === "assistant" && m.toolResults?.map((display, j) => (
              <ToolResultCard key={j} display={display} />
            ))}
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
  );
}
