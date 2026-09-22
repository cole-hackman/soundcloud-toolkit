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

/**
 * A title long enough that it cannot fit a 360px row alongside the artwork
 * and the download chip. Real playlists are full of titles this long
 * ("Artist - Track (Extended Mix) [Label]"), and a short fixture title hid a
 * clipping bug that only shows up once the title has to compete for width.
 */
const LONG_TRACK_TITLE = "Sample Playlist Track 4 With A Deliberately Very Long Title";

/**
 * `GET /api/playlists/:id` — the track-editor state of /playlist-modifier/,
 * which is where the row action cluster lives. Three short rows cover
 * first/middle/last (move-up and move-down disabled states); the fourth is
 * the long-title case, and is the downloadable one.
 */
const FAKE_PLAYLIST_DETAIL = {
  id: 1,
  title: "Sample Playlist 1",
  track_count: 4,
  artwork_url: null as string | null,
  tracks: Array.from({ length: 4 }, (_, i) => ({
    id: 300 + i,
    title: i === 3 ? LONG_TRACK_TITLE : `Sample Playlist Track ${i + 1}`,
    user: { username: "testartist" },
    artwork_url: null as string | null,
    duration: 210000,
    downloadable: i === 0 || i === 3,
    download_url:
      i === 0 || i === 3
        ? `https://api.soundcloud.com/tracks/${300 + i}/download`
        : undefined,
    permalink_url: `https://soundcloud.com/testartist/sample-playlist-track-${i + 1}`,
  })),
};

export { LONG_TRACK_TITLE };

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
 * `POST /api/resolve?v=2` — the result state of /link-resolver/, which is the
 * half of that page with the layout, the copy buttons and the embed in it.
 * Without this the page only ever shows its empty form.
 */
const FAKE_RESOLVE = {
  data: {
    type: "track",
    kind: "track",
    id: 400,
    title: "Sample Resolved Track",
    username: "testartist",
    user: { id: 1000002, username: "testartist" },
    permalink_url: "https://soundcloud.com/testartist/sample-resolved-track",
    artwork_url: null as string | null,
    duration_ms: 214000,
    description: "An obviously fake track used by the e2e harness.",
    tag_list: "house techno",
    created_at: "2026-01-02T03:04:05Z",
    playback_count: 1234,
    likes_count: 56,
    reposts_count: 7,
    comment_count: 8,
  },
  meta: {
    version: "2",
    source_url: "https://soundcloud.com/testartist/sample-resolved-track",
    resolved_at: "2026-09-22T12:00:00.000Z",
    cached: false,
  },
};

/** `GET /api/growth/history` — the empty state of the Campaign History tab. */
const FAKE_GROWTH_HISTORY = {
  actions: [] as unknown[],
  sessions: [] as unknown[],
};

/** `GET /api/growth/analytics` — the empty state of the Analytics tab. */
const FAKE_GROWTH_ANALYTICS = {
  perSeed: [] as unknown[],
  followBackCurve: [
    { bucket: "0-24h", followedBack: 0, notFollowedBack: 0 },
    { bucket: "1-3d", followedBack: 0, notFollowedBack: 0 },
  ],
  totalFollows: 0,
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

  // The SoundCloud embed widget. Stubbed so a test never depends on a
  // third-party origin being up, and so an axe run over the page is not
  // scoring SoundCloud's own player markup (which has its own violations
  // and is not ours to fix). The `<iframe>` element, and therefore its
  // `title`, is still exactly what the page rendered.
  await page.route("**/w.soundcloud.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html lang=\"en\"><head><title>Player stub</title></head><body></body></html>",
    }),
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
    if (method === "GET" && path === "/api/playlists") {
      return route.fulfill(json(FAKE_PLAYLISTS));
    }
    if (method === "GET" && /^\/api\/playlists\/\d+$/.test(path)) {
      return route.fulfill(
        json({ ...FAKE_PLAYLIST_DETAIL, id: Number(path.split("/").pop()) }),
      );
    }
    if (method === "GET" && path === "/api/likes/paged") {
      return route.fulfill(json(FAKE_LIKES_PAGED));
    }
    if (method === "GET" && (path === "/api/followings/paged" || path === "/api/followings")) {
      return route.fulfill(json(FAKE_FOLLOWINGS_PAGED));
    }
    if (method === "GET" && path === "/api/growth/limits") {
      return route.fulfill(json(FAKE_GROWTH_LIMITS));
    }
    if (method === "GET" && path === "/api/growth/stats") {
      return route.fulfill(json(FAKE_GROWTH_STATS));
    }
    if (method === "GET" && path === "/api/growth/history") {
      return route.fulfill(json(FAKE_GROWTH_HISTORY));
    }
    if (method === "GET" && path === "/api/growth/analytics") {
      return route.fulfill(json(FAKE_GROWTH_ANALYTICS));
    }
    if (method === "POST" && path === "/api/resolve") {
      return route.fulfill(json(FAKE_RESOLVE));
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
