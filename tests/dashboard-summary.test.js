import { buildDashboardSummary } from '../server/lib/dashboard-summary.js';

describe('dashboard summary', () => {
  test('prefers counts from /me when available', () => {
    const summary = buildDashboardSummary({
      me: {
        followers_count: 120,
        followings_count: 80,
        public_favorites_count: 450,
        playlist_count: 14,
      },
      playlists: { collection: [{ id: 1 }], total: 1 },
      likes: { collection: [{ id: 1 }], total: 1 },
      followings: { collection: [{ id: 1 }], total: 1 },
      followers: { collection: [{ id: 1 }], total: 1 },
    });

    expect(summary).toEqual({
      followers_count: 120,
      followings_count: 80,
      likes_count: 450,
      playlist_count: 14,
    });
  });

  test('falls back to endpoint totals and collection lengths when /me counts are missing or zero', () => {
    const summary = buildDashboardSummary({
      me: {
        followers_count: 0,
        followings_count: 0,
        public_favorites_count: 0,
        likes_count: 0,
        playlist_count: 0,
      },
      playlists: { collection: [{ id: 1 }, { id: 2 }] },
      likes: { collection: [{ id: 1 }], total: 33 },
      followings: { collection: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      followers: { collection: [{ id: 4 }], total: 18 },
    });

    expect(summary).toEqual({
      followers_count: 18,
      followings_count: 3,
      likes_count: 33,
      playlist_count: 2,
    });
  });
});
