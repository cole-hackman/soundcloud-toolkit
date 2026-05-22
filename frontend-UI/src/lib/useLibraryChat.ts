import { useCallback, useRef, useState } from 'react';
import type { ToolDisplay } from '@/components/chat/ToolResultCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolResults?: ToolDisplay[];
};
export type ToolStatus = { name: string; args: Record<string, unknown> } | null;

type StoredMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolName?: string | null;
  toolArgs?: Record<string, unknown> | null;
  toolResult?: { display?: ToolDisplay } | null;
};

function hydrate(stored: StoredMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const m of stored) {
    if (m.role === 'tool') {
      const last = result[result.length - 1];
      const display = m.toolResult?.display;
      if (last && last.role === 'assistant' && display) {
        last.toolResults = [...(last.toolResults || []), display];
      }
      continue;
    }
    if (m.role === 'user' || m.role === 'assistant') {
      result.push({ role: m.role, content: m.content || '', toolResults: [] });
    }
  }
  return result;
}

/** Streams a chat turn from POST /api/chat and parses the SSE frames. */
export function useLibraryChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus>(null);
  const bufferRef = useRef('');

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/api/chat/conversations/${id}`, { credentials: 'include' });
    if (!res.ok) return;
    const conv = await res.json();
    setConversationId(id);
    setMessages(hydrate(conv.messages || []));
  }, []);

  const startNew = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/chat/conversations`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const conv = await res.json();
    setConversationId(conv.id);
    setMessages([]);
    return conv.id as string;
  }, []);

  const send = useCallback(
    async (text: string) => {
      let activeId = conversationId;
      if (!activeId) {
        activeId = await startNew();
      }

      const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
      setMessages([...history, { role: 'assistant', content: '', toolResults: [] }]);
      setStreaming(true);
      setToolStatus(null);

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, messages: history }),
      });
      if (!res.body) {
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      bufferRef.current = '';

      const updateLast = (mutate: (m: ChatMessage) => ChatMessage) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = mutate(next[next.length - 1]);
          return next;
        });
      };

      const applyEvent = (event: string, data: string) => {
        const payload = JSON.parse(data);
        if (event === 'token') {
          updateLast((m) => ({ ...m, content: m.content + payload.text }));
        } else if (event === 'tool_status') {
          setToolStatus({ name: payload.name, args: payload.args });
        } else if (event === 'tool_result') {
          setToolStatus(null);
          const display = payload.result?.display as ToolDisplay | undefined;
          if (display) {
            updateLast((m) => ({ ...m, toolResults: [...(m.toolResults || []), display] }));
          }
        } else if (event === 'done') {
          setToolStatus(null);
        } else if (event === 'error') {
          updateLast((m) => ({ ...m, content: payload.error }));
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bufferRef.current += decoder.decode(value, { stream: true });
        const frames = bufferRef.current.split('\n\n');
        bufferRef.current = frames.pop() || '';
        for (const frame of frames) {
          const lines = frame.split('\n');
          const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim() || 'message';
          const data = lines.find((l) => l.startsWith('data:'))?.slice(5).trim() || '{}';
          try {
            applyEvent(event, data);
          } catch {
            /* ignore malformed frame */
          }
        }
      }
      setStreaming(false);
      setToolStatus(null);
    },
    [messages, conversationId, startNew],
  );

  return { messages, conversationId, streaming, toolStatus, send, loadConversation, startNew };
}
