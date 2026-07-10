import {
  validateCloneFollowedPlaylists,
  validateCreateFromFollowedLikes,
  validateFollowedUserLibraryPagination,
  validateFollowingUserId,
  validateGrowthDiscover,
  validateGrowthCheckFollowbacks,
  validateGrowthEngageBatch,
  validateReverseGrowthActions,
  validateBetaSignup,
  validateEvent,
} from '../server/middleware/validation.js';

async function runValidation(middlewares, { params = {}, query = {}, body = {} } = {}) {
  const req = { params, query, body };
  let statusCode = null;
  let payload = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };

  for (const middleware of middlewares) {
    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });
    if (!nextCalled) break;
  }

  return { statusCode, payload, req };
}

describe('followed user library validators', () => {
  test('accepts a positive followed user id param', async () => {
    const result = await runValidation(validateFollowingUserId, { params: { userId: '42' } });

    expect(result.statusCode).toBeNull();
    expect(result.req.params.userId).toBe(42);
  });

  test('rejects an invalid followed user id param', async () => {
    const result = await runValidation(validateFollowingUserId, { params: { userId: '0' } });

    expect(result.statusCode).toBe(400);
    expect(result.payload.error).toBe('Validation failed');
  });

  test('accepts followed library pagination query values', async () => {
    const result = await runValidation(validateFollowedUserLibraryPagination, {
      query: {
        limit: '25',
        next: 'https://api.soundcloud.com/users/42/likes/tracks?cursor=abc',
      },
    });

    expect(result.statusCode).toBeNull();
    expect(result.req.query.limit).toBe(25);
  });

  test('rejects followed library pagination with an invalid next cursor', async () => {
    const result = await runValidation(validateFollowedUserLibraryPagination, {
      query: { next: 'not-a-url' },
    });

    expect(result.statusCode).toBe(400);
  });

  test('accepts selected followed likes with a title', async () => {
    const result = await runValidation(validateCreateFromFollowedLikes, {
      body: { mode: 'selected', trackIds: [1, 2, 3], title: 'Coolio Likes' },
    });

    expect(result.statusCode).toBeNull();
  });

  test('accepts all followed likes with a target playlist', async () => {
    const result = await runValidation(validateCreateFromFollowedLikes, {
      body: { mode: 'all', targetPlaylistId: 123 },
    });

    expect(result.statusCode).toBeNull();
    expect(result.req.body.targetPlaylistId).toBe(123);
  });

  test('rejects selected followed likes without track ids', async () => {
    const result = await runValidation(validateCreateFromFollowedLikes, {
      body: { mode: 'selected', title: 'Coolio Likes' },
    });

    expect(result.statusCode).toBe(400);
  });

  test('rejects followed likes creation without a title or target playlist', async () => {
    const result = await runValidation(validateCreateFromFollowedLikes, {
      body: { mode: 'all' },
    });

    expect(result.statusCode).toBe(400);
  });

  test('accepts selected followed playlist clone ids', async () => {
    const result = await runValidation(validateCloneFollowedPlaylists, {
      body: { playlistIds: [11, 12], titlePrefix: 'DJ Coolio' },
    });

    expect(result.statusCode).toBeNull();
  });

  test('rejects too many followed playlists to clone at once', async () => {
    const result = await runValidation(validateCloneFollowedPlaylists, {
      body: { playlistIds: Array.from({ length: 21 }, (_, index) => index + 1) },
    });

    expect(result.statusCode).toBe(400);
  });
});

describe('growth discovery validators', () => {
  test('accepts valid growth discovery payload', async () => {
    const result = await runValidation(validateGrowthDiscover, {
      body: { inspirationUserIds: [1, 2], limit: 25, strategy: 'followers' },
    });
    expect(result.statusCode).toBeNull();
  });

  test('rejects empty inspirationUserIds list', async () => {
    const result = await runValidation(validateGrowthDiscover, {
      body: { inspirationUserIds: [], limit: 25 },
    });
    expect(result.statusCode).toBe(400);
  });

  test('rejects strategy not in list', async () => {
    const result = await runValidation(validateGrowthDiscover, {
      body: { inspirationUserIds: [1], strategy: 'invalid_strategy' },
    });
    expect(result.statusCode).toBe(400);
  });

  test('accepts a valid engagement batch payload', async () => {
    const result = await runValidation(validateGrowthEngageBatch, {
      body: {
        targets: [
          { userId: 42, likeTrackId: 101, targetName: 'DJ Cool' },
          { userId: 43 },
        ],
        likeTracks: true,
        sessionLabel: 'Seed: DJ Cool',
      },
    });
    expect(result.statusCode).toBeNull();
  });

  test('rejects an engagement batch with an invalid target userId', async () => {
    const result = await runValidation(validateGrowthEngageBatch, {
      body: { targets: [{ userId: 'not_an_int' }] },
    });
    expect(result.statusCode).toBe(400);
  });

  test('rejects an engagement batch over the 50-target cap', async () => {
    const targets = Array.from({ length: 51 }, (_, i) => ({ userId: i + 1 }));
    const result = await runValidation(validateGrowthEngageBatch, {
      body: { targets },
    });
    expect(result.statusCode).toBe(400);
  });

  test('accepts valid reverse filter', async () => {
    const result = await runValidation(validateReverseGrowthActions, {
      body: { filter: { sessionId: 'sess123', actionType: 'follow' } },
    });
    expect(result.statusCode).toBeNull();
  });

  test('rejects reverse request when both actionIds and filter are absent', async () => {
    const result = await runValidation(validateReverseGrowthActions, {
      body: {},
    });
    expect(result.statusCode).toBe(400);
  });

  test('accepts an optional follow-back session id and rejects an invalid one', async () => {
    const valid = await runValidation(validateGrowthCheckFollowbacks, {
      body: { sessionId: 'sess_123' },
    });
    const invalid = await runValidation(validateGrowthCheckFollowbacks, {
      body: { sessionId: 123 },
    });

    expect(valid.statusCode).toBeNull();
    expect(invalid.statusCode).toBe(400);
  });
});

describe('beta signup validator', () => {
  test('accepts a feedback-only response without email', async () => {
    const result = await runValidation(validateBetaSignup, {
      body: {
        rekordboxUse: 'rekordbox_primary',
        interest: 'somewhat',
        wantsBeta: false,
        context: 'dashboard',
      },
    });
    expect(result.statusCode).toBeNull();
  });

  test('requires email when wantsBeta is true', async () => {
    const result = await runValidation(validateBetaSignup, {
      body: {
        rekordboxUse: 'rekordbox_primary',
        interest: 'very',
        wantsBeta: true,
        context: 'post-merge',
      },
    });
    expect(result.statusCode).toBe(400);
  });

  test('accepts a full beta signup with valid email', async () => {
    const result = await runValidation(validateBetaSignup, {
      body: {
        rekordboxUse: 'rekordbox_primary',
        platform: 'mac',
        cullMethod: 'tedious',
        featuresWanted: 'swipe_cull,waveform_cue',
        editHesitations: 'corrupt_db',
        trustDirectWrite: 'yes',
        interest: 'very',
        wantsBeta: true,
        email: 'dj@example.com',
        wantsCall: true,
        suggestions: 'BPM sorting please',
        nameIdea: 'CrateCull',
        context: 'dashboard',
      },
    });
    expect(result.statusCode).toBeNull();
  });

  test('rejects an invalid rekordboxUse value', async () => {
    const result = await runValidation(validateBetaSignup, {
      body: { rekordboxUse: 'serato', interest: 'very', context: 'dashboard' },
    });
    expect(result.statusCode).toBe(400);
  });

  test('rejects a malformed email even when provided', async () => {
    const result = await runValidation(validateBetaSignup, {
      body: {
        rekordboxUse: 'rekordbox_primary',
        interest: 'very',
        wantsBeta: true,
        email: 'not-an-email',
        context: 'dashboard',
      },
    });
    expect(result.statusCode).toBe(400);
  });
});

describe('feature usage event validator', () => {
  test('accepts a short feature slug', async () => {
    const result = await runValidation(validateEvent, {
      body: { feature: 'playlist-cloner' },
    });

    expect(result.statusCode).toBeNull();
  });

  test('rejects arbitrary event names', async () => {
    const result = await runValidation(validateEvent, {
      body: { feature: 'playlist cloner?playlist=123' },
    });

    expect(result.statusCode).toBe(400);
  });
});
