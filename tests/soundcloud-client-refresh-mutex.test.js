import { jest } from '@jest/globals';

const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
process.env.ENCRYPTION_KEY = 'x'.repeat(32);

const tokenUpdate = jest.fn().mockResolvedValue({});
jest.unstable_mockModule('../server/lib/prisma.js', () => ({
  default: { token: { update: tokenUpdate } },
}));

const { soundcloudClient, clearRecentRotations } =
  await import('../server/lib/soundcloud-client.js');
const { runWithTokenContext } = await import('../server/lib/token-context.js');

const ORIGINAL_FETCH = global.fetch;

let resolveAllFetches;
beforeEach(() => {
  tokenUpdate.mockClear();
  // The rotation memo is module state and outlives a single test.
  clearRecentRotations();
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

  // A DIFFERENT refresh token, because SoundCloud rotated it: this is what a
  // later request genuinely presents. (Re-presenting 'rt' is now answered from
  // the rotation memo rather than re-spent upstream — see the test below and
  // tests/routes/token-refresh.test.js.)
  const secondRun = runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('fresh-r')
  );
  await Promise.resolve();
  resolveAllFetches();
  await secondRun;

  // the map must be cleared on settle, so the second call exchanges again
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('a FAILED refresh does not poison later attempts for that user', async () => {
  // The reason the in-flight entry is cleared in a `finally`. A failure also
  // records nothing in the rotation memo, so the same token is exchanged
  // again rather than being served a result that never existed.
  const quiet = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response('upstream unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ access_token: 'fresh-a', refresh_token: 'fresh-r', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ));

    await expect(runWithTokenContext({ userId: 'user-1' }, () =>
      soundcloudClient.refreshTokensAndPersist('rt')
    )).rejects.toThrow();

    const second = await runWithTokenContext({ userId: 'user-1' }, () =>
      soundcloudClient.refreshTokensAndPersist('rt')
    );

    expect(second.access_token).toBe('fresh-a');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  } finally {
    quiet.mockRestore();
  }
});

test('a refresh token already spent by an earlier exchange is not re-presented upstream', async () => {
  // The sequential case the mutex never covered: the same captured pair is
  // handed to two calls in a row. Re-presenting it would be answered
  // `invalid_grant`, which the revocation detector reads as "the user revoked
  // us". It is served from what the first exchange produced instead.
  const first = await runWithTokenContext({ userId: 'user-1' }, async () => {
    const pending = soundcloudClient.refreshTokensAndPersist('rt');
    await Promise.resolve();
    resolveAllFetches();
    return pending;
  });

  const second = await runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt')
  );

  expect(second).toEqual(first);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(tokenUpdate).toHaveBeenCalledTimes(1);
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
