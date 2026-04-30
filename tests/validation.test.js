import {
  validateCloneFollowedPlaylists,
  validateCreateFromFollowedLikes,
  validateFollowedUserLibraryPagination,
  validateFollowingUserId,
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
