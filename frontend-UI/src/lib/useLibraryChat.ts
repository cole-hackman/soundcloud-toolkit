import { useCallback, useRef, useState } from 'react';
import type { ToolDisplay } from '@/components/chat/ToolResultCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolResults?: ToolDisplay[];
};
export type ToolStatus = { name: string; args: Record<string, unknown> } | null;

/** Streams a chat turn from POST /api/chat and parses the SSE frames. */
export function useLibraryChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus>(null);
  const bufferRef = useRef('');

  const send = useCallback(
    async (text: string) => {
      const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
      setMessages([...history, { role: 'assistant', content: '', toolResults: [] }]);
      setStreaming(true);
      setToolStatus(null);

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
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

      // Parse SSE: events separated by blank lines; lines prefixed with "event:" / "data:".
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
    [messages],
  );

  return { messages, streaming, toolStatus, send };
}
