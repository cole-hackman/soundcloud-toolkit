import { useCallback, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
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
      setMessages([...history, { role: 'assistant', content: '' }]);
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

      const applyEvent = (event: string, data: string) => {
        const payload = JSON.parse(data);
        if (event === 'token') {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: 'assistant',
              content: next[next.length - 1].content + payload.text,
            };
            return next;
          });
        } else if (event === 'tool_status') {
          setToolStatus({ name: payload.name, args: payload.args });
        } else if (event === 'tool_result' || event === 'done') {
          setToolStatus(null);
        } else if (event === 'error') {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: payload.error };
            return next;
          });
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
