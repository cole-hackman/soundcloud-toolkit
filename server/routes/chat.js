import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { chatRateLimiter, heavyOperationRateLimiter } from '../middleware/rateLimiter.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { logOperation } from '../lib/analytics.js';
import * as index from '../lib/library-index.js';
import { CHAT_TOOL_DEFINITIONS, dispatchTool } from '../lib/chat-tools.js';
import { createChatStream } from '../lib/chat-provider.js';
import { buildSystemPrompt } from '../lib/chat-prompt.js';
import { formatSseEvent } from '../lib/sse.js';

const router = express.Router();
const MAX_TOOL_CALLS_PER_TURN = 6;

/** GET /api/library/snapshot — current index status. */
router.get('/library/snapshot', authenticateUser, async (req, res) => {
  try {
    const snap = await index.getSnapshot(req.user.id);
    res.json({ ...snap, stale: index.isStale(snap) });
  } catch (error) {
    logger.error('Snapshot status error:', safeError(error));
    res.status(500).json({ error: 'Failed to read library status' });
  }
});

/** POST /api/library/sync — rebuild the index asynchronously. */
router.post('/library/sync', authenticateUser, heavyOperationRateLimiter, async (req, res) => {
  const snap = await index.getSnapshot(req.user.id);
  if (snap.status === 'syncing') return res.json({ status: 'syncing', alreadyRunning: true });

  // Fire-and-forget; client polls /library/snapshot.
  index
    .syncLibrary(req.user.id, req.accessToken, req.refreshToken)
    .then((r) =>
      logOperation({
        userId: req.user.id,
        action: 'library-sync',
        itemCount: r.playlistCount,
        trackCount: r.likeCount,
        status: 'success',
      }),
    )
    .catch((error) => logger.error('Async sync failed:', safeError(error)));

  res.status(202).json({ status: 'syncing' });
});

/** POST /api/chat — streaming tool-calling chat over SSE. body: { messages: [{role, content}] } */
router.post('/chat', authenticateUser, chatRateLimiter, async (req, res) => {
  const userMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!userMessages.length) return res.status(400).json({ error: 'messages array is required' });

  // Trigger a background sync if the index has never been built.
  const snap = await index.getSnapshot(req.user.id);
  if (snap.status === 'stale' && snap.likeCount === 0) {
    index
      .syncLibrary(req.user.id, req.accessToken, req.refreshToken)
      .catch((e) => logger.error('Lazy sync failed:', safeError(e)));
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event, data) => res.write(formatSseEvent(event, data));
  const messages = [
    { role: 'system', content: buildSystemPrompt(snap) },
    ...userMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    })),
  ];

  try {
    let toolCallsUsed = 0;
    // Tool-calling loop: stream assistant text; when the model requests tools, run them and continue.
    for (let iteration = 0; iteration < MAX_TOOL_CALLS_PER_TURN + 1; iteration++) {
      const stream = await createChatStream({ messages, tools: CHAT_TOOL_DEFINITIONS });
      let assistantText = '';
      const toolCalls = []; // accumulate streamed tool_call deltas by index

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta || {};
        if (delta.content) {
          assistantText += delta.content;
          send('token', { text: delta.content });
        }
        for (const tc of delta.tool_calls || []) {
          const slot = (toolCalls[tc.index] ||= { id: '', name: '', args: '' });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name = tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
        }
      }

      if (!toolCalls.length) {
        send('done', { ok: true });
        break;
      }

      // Record the assistant's tool-call request, then execute each tool.
      messages.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: t.args || '{}' },
        })),
      });

      for (const call of toolCalls) {
        if (toolCallsUsed >= MAX_TOOL_CALLS_PER_TURN) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: 'tool call budget exhausted' }),
          });
          continue;
        }
        toolCallsUsed++;
        let args = {};
        try {
          args = JSON.parse(call.args || '{}');
        } catch {
          /* leave empty */
        }
        send('tool_status', { name: call.name, args });
        const result = await dispatchTool(call.name, args, {
          userId: req.user.id,
          accessToken: req.accessToken,
          refreshToken: req.refreshToken,
          index,
        });
        send('tool_result', { name: call.name, result });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    logOperation({ userId: req.user.id, action: 'chat', itemCount: toolCallsUsed, status: 'success' });
  } catch (error) {
    logger.error('Chat error:', safeError(error));
    send('error', { error: 'Chat failed. Please try again.' });
  } finally {
    res.end();
  }
});

export default router;
