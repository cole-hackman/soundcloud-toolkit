import { jest } from '@jest/globals';

const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
process.env.ENCRYPTION_KEY = 'x'.repeat(32);

const tokenUpdate = jest.fn().mockResolvedValue({});
jest.unstable_mockModule('../server/lib/prisma.js', () => ({
  default: { token: { update: tokenUpdate } },
}));

const { soundcloudClient } = await import('../server/lib/soundcloud-client.js');
const { runWithTokenContext } = await import('../server/lib/token-context.js');

const ORIGINAL_FETCH = global.fetch;

let resolveAllFetches;
beforeEach(() => {
  tokenUpdate.mockClear();
  // Track all fetch calls and their resolvers so we can control when they settle.
  const fetchResolvers = [];

  global.fetch = jest.fn(() => new Promise((resolve) => {
    const response = new Response(
      JSON.stringify({ access_token: 'fresh-a', refresh_token: 'fresh-r', expires_in: 3600 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    fetchResolvers.push(() => resolve(response));
  }));

  resolveAllFetches = () => {
    fetchResolvers.forEach(r => r());
    fetchResolvers.length = 0;
  };
});

afterAll(() => {
  if (ORIGINAL_ENCRYPTION_KEY === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
  global.fetch = ORIGINAL_FETCH;
});

test('concurrent refreshes for the SAME user collapse into one token exchange', async () => {
  const both = runWithTokenContext({ userId: 'user-1' }, () =>
    Promise.all([
      soundcloudClient.refreshTokensAndPersist('rt'),
      soundcloudClient.refreshTokensAndPersist('rt'),
    ])
  );

  await Promise.resolve();
  resolveAllFetches();
  const [first, second] = await both;

  // ONE network exchange, ONE database write — not two of each
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(tokenUpdate).toHaveBeenCalledTimes(1);
  // both callers get the same fresh tokens
  expect(first.access_token).toBe('fresh-a');
  expect(second.access_token).toBe('fresh-a');
});

test('a later refresh for the same user is NOT served from a stale in-flight entry', async () => {
  const firstRun = runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt')
  );
  await Promise.resolve();
  resolveAllFetches();
  await firstRun;

  const secondRun = runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt')
  );
  await Promise.resolve();
  resolveAllFetches();
  await secondRun;

  // the map must be cleared on settle, so the second call exchanges again
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('different users refresh independently and are not serialized together', async () => {
  const a = runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt-a')
  );
  const b = runWithTokenContext({ userId: 'user-2' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt-b')
  );

  await Promise.resolve();
  resolveAllFetches();
  await Promise.all([a, b]);

  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(tokenUpdate).toHaveBeenCalledTimes(2);
  const userIds = tokenUpdate.mock.calls.map((c) => c[0].where.userId).sort();
  expect(userIds).toEqual(['user-1', 'user-2']);
});

test('a rejected refresh clears the in-flight entry so the next attempt retries', async () => {
  global.fetch = jest.fn(() => Promise.resolve(new Response('', { status: 400 })));

  await expect(
    runWithTokenContext({ userId: 'user-1' }, () =>
      soundcloudClient.refreshTokensAndPersist('rt')
    )
  ).rejects.toThrow();

  await expect(
    runWithTokenContext({ userId: 'user-1' }, () =>
      soundcloudClient.refreshTokensAndPersist('rt')
    )
  ).rejects.toThrow();

  // second attempt actually hit the network — the failed promise was not cached
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
