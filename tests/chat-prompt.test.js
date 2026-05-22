import { buildSystemPrompt } from '../server/lib/chat-prompt.js';

describe('buildSystemPrompt', () => {
  test('includes snapshot freshness and the answer-only-from-tools rule', () => {
    const prompt = buildSystemPrompt({ status: 'fresh', likeCount: 4812, likesSyncedAt: '2026-05-21T00:00:00Z' });
    expect(prompt).toMatch(/4812/);
    expect(prompt).toMatch(/only.*tool/i);
  });
  test('warns when the index is still syncing', () => {
    const prompt = buildSystemPrompt({ status: 'syncing', likeCount: 100, likesSyncedAt: null });
    expect(prompt).toMatch(/partial|syncing/i);
  });
});
