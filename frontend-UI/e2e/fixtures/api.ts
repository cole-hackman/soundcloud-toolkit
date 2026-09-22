import type { Page } from "@playwright/test";

/**
 * Mocked `/api/*` responses for the e2e harness.
 *
 * Every value here is obviously fake ("Test User", "Sample Playlist 1") —
 * never real account data, so a recording or a diff of this file never
 * carries anything that needs to be treated as sensitive.
 *
 * Shapes mirror what `src/lib/queries.ts` / `src/lib/progressive.ts` ask
 * for, not necessarily the exact SoundCloud-wrapped shape the live backend
 * returns for every route — this is a fixture for exercising pages and
 * running axe against them, not a contract test of the API.
 */

const FAKE_USER = {
  userId: "u1",
  username: "testuser",
  displayName: "Test User",
  avatarUrl: null as string | null,
};

const FAKE_ME = {
  id: 1000001,
  username: "testuser",
  full_name: "Test User",
  avatar_url: null as string | null,
  followers_count: 12,
  followings_count: 8,
  likes_count: 5,
  track_count: 0,
  playlist_count: 3,
  permalink_url: "https://soundcloud.com/testuser",
};

const FAKE_DASHBOARD_SUMMARY = {
  followers_count: 12,
  followings_count: 8,
  likes_count: 5,
  playlist_count: 3,
};

const FAKE_PLAYLISTS = {
  collection: [
    { id: 1, title: "Sample Playlist 1", track_count: 12, artwork_url: null, permalink_url: "https://soundcloud.com/testuser/sets/sample-playlist-1" },
    { id: 2, title: "Sample Playlist 2", track_count: 40, artwork_url: null, permalink_url: "https://soundcloud.com/testuser/sets/sample-playlist-2" },
    { id: 3, title: "Sample Playlist 3", track_count: 7, artwork_url: null, permalink_url: "https://soundcloud.com/testuser/sets/sample-playlist-3" },
  ],
  total: 3,
};

const FAKE_LIKES_PAGED = {
  collection: Array.from({ length: 5 }, (_, i) => ({
    id: 100 + i,
    title: `Sample Track ${i + 1}`,
    user: { username: "testartist" },
    artwork_url: null,
    duration: 200000,
    permalink_url: `https://soundcloud.com/testartist/sample-track-${i + 1}`,
  })),
  next_href: null as string | null,
};

const FAKE_FOLLOWINGS_PAGED = {
  collection: Array.from({ length: 3 }, (_, i) => ({
    id: 200 + i,
    username: `testfollowing${i + 1}`,
    avatar_url: null,
    followers_count: 100 + i,
    track_count: 10 + i,
    permalink_url: `https://soundcloud.com/testfollowing${i + 1}`,
  })),
  next_href: null as string | null,
};

/**
 * `GET /api/playlists/:id`. One of each health state, so the health check's
 * summary bar, filter pills and per-row badges are all really on the page when
 * it is audited — an all-playable list would render none of them.
 */
const FAKE_PLAYLIST_DETAIL = {
  id: 1,
  title: "Sample Playlist 1",
  track_count: 4,
  artwork_url: null as string | null,
  permalink_url: "https://soundcloud.com/testuser/sets/sample-playlist-1",
  tracks: [
    { id: 100, title: "Sample Track 1", user: { username: "testartist" }, artwork_url: null, duration: 200000, access: "playable", streamable: true, blocked_at: null },
    { id: 101, title: "Sample Track 2", user: { username: "testartist" }, artwork_url: null, duration: 210000, access: "playable", streamable: true, blocked_at: null },
    { id: 102, title: "Sample Track 3", user: { username: "testartist" }, artwork_url: null, duration: 190000, access: "preview", streamable: true, blocked_at: null },
    { id: 103, title: "Sample Track 4", user: { username: "testartist" }, artwork_url: null, duration: 180000, access: "blocked", streamable: false, blocked_at: "2026-01-01T00:00:00.000Z" },
  ],
};

/**
 * `GET /api/playlists/search-tracks`. Two of the three rows are the same track
 * in the same playlist, which is what makes the "x2 in this playlist" badge —
 * the widest thing on a match row — part of what gets audited and measured.
 */
const FAKE_SEARCH_TRACKS = {
  keywords: ["sample"],
  matches: [
    {
      trackId: 100,
      title: "Sample Track 1",
      artist: "testartist",
      permalink_url: "https://soundcloud.com/testartist/sample-track-1",
      position: 0,
      playlistId: 1,
      playlistTitle: "Sample Playlist 1",
      keyword: "sample",
      matchedIn: "title",
    },
    {
      trackId: 101,
      title: "Sample Track 2",
      artist: "testartist",
      permalink_url: null,
      position: 1,
      playlistId: 1,
      playlistTitle: "Sample Playlist 1",
      keyword: "sample",
      matchedIn: "title",
    },
    {
      trackId: 101,
      title: "Sample Track 2",
      artist: "testartist",
      permalink_url: null,
      position: 4,
      playlistId: 1,
      playlistTitle: "Sample Playlist 1",
      keyword: "sample",
      matchedIn: "title",
    },
  ],
  stats: {
    playlistsSearched: 3,
    tracksScanned: 59,
    matchCount: 3,
    uniqueTrackCount: 2,
    playlistsFailed: 0,
  },
  failed: [] as unknown[],
  capped: false,
  page: {
    limit: 20,
    offset: 0,
    returned: 3,
    total: 3,
    hasMore: false,
    from: 1,
    to: 3,
    stale: false,
    truncated: false,
  },
};

/**
 * `GET /api/library/audit`. One playlist with findings and one without, so
 * both verdicts ("Issues found" / "Healthy") are on the page when it is
 * audited.
 */
const FAKE_LIBRARY_AUDIT = {
  page: {
    limit: 20,
    offset: 0,
    returned: 2,
    total: 2,
    hasMore: false,
    from: 1,
    to: 2,
    stale: false,
    truncated: false,
  },
  failed: [] as unknown[],
  summary: {
    playlists: 2,
    tracks: 52,
    duplicates: 1,
    unavailable: 2,
    directDownloads: 3,
    purchaseLinks: 1,
    nearCap: 0,
  },
  playlists: [
    {
      id: 1,
      title: "Sample Playlist 1",
      trackCount: 12,
      summary: {
        totalTracks: 12,
        duplicateTracks: 1,
        unavailableTracks: 2,
        directDownloads: 3,
        purchaseLinks: 1,
        nearCap: false,
      },
    },
    {
      id: 2,
      title: "Sample Playlist 2",
      trackCount: 40,
      summary: {
        totalTracks: 40,
        duplicateTracks: 0,
        unavailableTracks: 0,
        directDownloads: 0,
        purchaseLinks: 0,
        nearCap: false,
      },
    },
  ],
};

/**
 * `GET /api/followings/:id/likes|playlists|liked-playlists/paged` — one page of
 * a followed user's public library, so Following Library renders real rows in
 * every tab instead of the "no public liked tracks" empty state.
 */
const FAKE_FOLLOWED_LIKES_PAGED = {
  collection: Array.from({ length: 3 }, (_, i) => ({
    id: 300 + i,
    title: `Sample Public Track ${i + 1}`,
    user: { username: "testfollowing1" },
    artwork_url: null as string | null,
    duration: 195000,
    permalink_url: `https://soundcloud.com/testfollowing1/sample-public-track-${i + 1}`,
  })),
  next_href: null as string | null,
};

const FAKE_FOLLOWED_PLAYLISTS_PAGED = {
  collection: Array.from({ length: 2 }, (_, i) => ({
    id: 400 + i,
    title: `Sample Public Playlist ${i + 1}`,
    user: { username: "testfollowing1" },
    artwork_url: null as string | null,
    track_count: 9 + i,
    permalink_url: `https://soundcloud.com/testfollowing1/sets/sample-public-playlist-${i + 1}`,
  })),
  next_href: null as string | null,
};

/**
 * `POST /api/resolve/batch?v=2` — one of each row shape (track, playlist and a
 * failure), so the batch resolver's filters, row actions and the error styling
 * are all on the page when it is audited.
 */
const FAKE_RESOLVE_BATCH = {
  results: [
    {
      index: 0,
      url: "https://soundcloud.com/testartist/sample-track-1",
      status: "ok",
      data: {
        type: "track",
        id: 100,
        title: "Sample Track 1",
        user: { username: "testartist" },
        duration_ms: 200000,
        permalink_url: "https://soundcloud.com/testartist/sample-track-1",
      },
    },
    {
      index: 1,
      url: "https://soundcloud.com/testuser/sets/sample-playlist-1",
      status: "ok",
      data: {
        type: "playlist",
        id: 1,
        title: "Sample Playlist 1",
        user: { username: "testuser" },
        track_count: 12,
        permalink_url: "https://soundcloud.com/testuser/sets/sample-playlist-1",
      },
    },
    {
      index: 2,
      url: "https://soundcloud.com/testartist/does-not-exist",
      status: "error",
      error: "Not found",
    },
  ],
  summary: { total: 3, ok: 2, error: 1 },
  meta: { version: "2", resolved_at: "2026-09-22T12:00:00.000Z" },
};

/** `POST /api/playlists/compare` — a shared track plus one unique to each side. */
const FAKE_COMPARE = {
  summary: {
    playlistA: { id: 1, title: "Sample Playlist 1", trackCount: 2 },
    playlistB: { id: 2, title: "Sample Playlist 2", trackCount: 2 },
    overlapCount: 1,
    uniqueToACount: 1,
    uniqueToBCount: 1,
    overlapPercent: 33,
  },
  overlap: [{ id: 100, title: "Sample Track 1", user: { username: "testartist" } }],
  uniqueToA: [{ id: 101, title: "Sample Track 2", user: { username: "testartist" } }],
  uniqueToB: [{ id: 102, title: "Sample Track 3", user: { username: "testartist" } }],
};

/**
 * `GET /api/reposts` — the full (non-paged) crawl the reposts export asks for.
 * One track and one playlist, which is the shape that distinguishes it.
 */
const FAKE_REPOSTS = {
  collection: [
    {
      id: 500,
      urn: "soundcloud:tracks:500",
      resourceType: "track",
      title: "Sample Reposted Track",
      user: { username: "testartist" },
      artwork_url: null as string | null,
      permalink_url: "https://soundcloud.com/testartist/sample-reposted-track",
      created_at: "2026-09-01T00:00:00.000Z",
    },
    {
      id: 501,
      urn: "soundcloud:playlists:501",
      resourceType: "playlist",
      title: "Sample Reposted Playlist",
      user: { username: "testartist" },
      artwork_url: null as string | null,
      permalink_url: "https://soundcloud.com/testartist/sets/sample-reposted-playlist",
      created_at: "2026-09-02T00:00:00.000Z",
    },
  ],
  total: 2,
};

/** `POST /api/playlists/clone` — two parts, so the "Parts Created" card renders. */
const FAKE_CLONE = {
  playlists: [
    { id: 11, title: "Clone of Sample Playlist 1 (1/2)", permalink_url: "https://soundcloud.com/testuser/sets/clone-1" },
    { id: 12, title: "Clone of Sample Playlist 1 (2/2)", permalink_url: "https://soundcloud.com/testuser/sets/clone-2" },
  ],
  stats: { totalTracks: 12, numPlaylistsCreated: 2 },
};

/** `POST /api/resolve?v=2` — the single-URL shape the cloner resolves with. */
const FAKE_RESOLVE_SINGLE = {
  type: "playlist",
  id: 1,
  title: "Sample Playlist 1",
  user: { username: "testuser" },
  track_count: 12,
  permalink_url: "https://soundcloud.com/testuser/sets/sample-playlist-1",
  artwork_url: null as string | null,
};

/** What `POST /api/feedback` answers with on a 201 — id and timestamp only. */
const FAKE_FEEDBACK_CREATED = {
  id: "fb_1",
  createdAt: "2026-09-22T12:00:00.000Z",
};

/** `GET /api/feedback/mine` — empty, so the "Your recent reports" list stays
 *  out of the way of the submit flow under test. */
const FAKE_FEEDBACK_MINE = { items: [] as unknown[] };

const FAKE_GROWTH_LIMITS = {
  dailyCap: 50,
  used24h: 0,
  remaining: 50,
  cooldownRemainingMs: 0,
};

const FAKE_GROWTH_STATS = {
  totalFollowed: 0,
  totalLiked: 0,
  followedBackRate: 0,
  activeFollows: 0,
  reversedFollows: 0,
  uncheckedFollows: 0,
};

/**
 * Rebrand announcement gate — matches the keys/value `src/lib/rebrand.ts`
 * checks, so the one-time modal and the site-wide banner both treat the
 * current announcement as already acknowledged and stay out of the way of
 * whatever the test is actually looking at.
 */
const REBRAND_ANNOUNCEMENT_VERSION = "2026-09-track-toolkit";
const REBRAND_BANNER_KEY = "track-toolkit-rebrand-banner";
const REBRAND_ACK_KEY = "track-toolkit-rebrand-ack";

/** Matches `src/lib/whatsNew.ts` — keeps the unrelated "what's new" modal
 *  from also covering the page during a dashboard run. */
const WHATS_NEW_VERSION = "2026-07-growth";
const WHATS_NEW_DISMISS_KEY = "sc-toolkit-whatsnew-dismissed";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

/**
 * Route every `/api/**` request to a fixed, obviously-fake response and seed
 * localStorage so the rebrand announcements don't cover the page under test.
 */
export async function mockApi(page: Page): Promise<void> {
  await page.addInitScript(
    ({ version, bannerKey, ackKey, whatsNewVersion, whatsNewKey }) => {
      try {
        window.localStorage.setItem(bannerKey, version);
        window.localStorage.setItem(ackKey, version);
        window.localStorage.setItem(whatsNewKey, whatsNewVersion);
      } catch {
        // Private mode / blocked storage — nothing this init script can do.
      }
    },
    {
      version: REBRAND_ANNOUNCEMENT_VERSION,
      bannerKey: REBRAND_BANNER_KEY,
      ackKey: REBRAND_ACK_KEY,
      whatsNewVersion: WHATS_NEW_VERSION,
      whatsNewKey: WHATS_NEW_DISMISS_KEY,
    },
  );

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === "GET" && path === "/api/auth/me") {
      return route.fulfill(json(FAKE_USER));
    }
    if (method === "GET" && path === "/api/me") {
      return route.fulfill(json(FAKE_ME));
    }
    if (method === "GET" && path === "/api/dashboard/summary") {
      return route.fulfill(json(FAKE_DASHBOARD_SUMMARY));
    }
    if (method === "POST" && path === "/api/playlists/clone") {
      return route.fulfill(json(FAKE_CLONE));
    }
    if (method === "POST" && path === "/api/playlists/compare") {
      return route.fulfill(json(FAKE_COMPARE));
    }
    if (method === "POST" && path === "/api/resolve/batch") {
      return route.fulfill(json(FAKE_RESOLVE_BATCH));
    }
    if (method === "POST" && path === "/api/resolve") {
      return route.fulfill(json(FAKE_RESOLVE_SINGLE));
    }
    if (method === "GET" && path === "/api/library/audit") {
      return route.fulfill(json(FAKE_LIBRARY_AUDIT));
    }
    if (method === "GET" && path === "/api/playlists/search-tracks") {
      return route.fulfill(json(FAKE_SEARCH_TRACKS));
    }
    if (method === "GET" && path === "/api/playlists") {
      return route.fulfill(json(FAKE_PLAYLISTS));
    }
    if (method === "GET" && /^\/api\/playlists\/\d+$/.test(path)) {
      return route.fulfill(
        json({ ...FAKE_PLAYLIST_DETAIL, id: Number(path.split("/").pop()) }),
      );
    }
    if (method === "GET" && (path === "/api/likes/paged" || path === "/api/likes")) {
      return route.fulfill(json(FAKE_LIKES_PAGED));
    }
    if (method === "GET" && (path === "/api/reposts" || path === "/api/reposts/paged")) {
      return route.fulfill(json(FAKE_REPOSTS));
    }
    if (method === "GET" && (path === "/api/followings/paged" || path === "/api/followings")) {
      return route.fulfill(json(FAKE_FOLLOWINGS_PAGED));
    }
    if (method === "GET" && /^\/api\/followings\/\d+\/likes\/paged$/.test(path)) {
      return route.fulfill(json(FAKE_FOLLOWED_LIKES_PAGED));
    }
    if (method === "GET" && /^\/api\/followings\/\d+\/(liked-)?playlists\/paged$/.test(path)) {
      return route.fulfill(json(FAKE_FOLLOWED_PLAYLISTS_PAGED));
    }
    if (method === "GET" && path === "/api/growth/limits") {
      return route.fulfill(json(FAKE_GROWTH_LIMITS));
    }
    if (method === "GET" && path === "/api/growth/stats") {
      return route.fulfill(json(FAKE_GROWTH_STATS));
    }
    if (method === "POST" && path === "/api/events") {
      return route.fulfill({ status: 204, body: "" });
    }
    if (method === "POST" && path === "/api/feedback") {
      return route.fulfill(json(FAKE_FEEDBACK_CREATED, 201));
    }
    if (method === "GET" && path === "/api/feedback/mine") {
      return route.fulfill(json(FAKE_FEEDBACK_MINE));
    }

    // eslint-disable-next-line no-console
    console.warn(`[e2e mockApi] unhandled ${method} ${path} — returning {} 200`);
    return route.fulfill(json({}));
  });
}
