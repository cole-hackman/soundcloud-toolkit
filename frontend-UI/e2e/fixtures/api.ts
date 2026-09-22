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
  // The account page prints this back as "SoundCloud id N"; it is the same
  // fake numeric id FAKE_ME carries.
  soundcloudId: 1000001,
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
 * `GET /api/followers/paged` — the followers side of the following manager.
 * Only the first fake following is also a follower, so the "Not Following
 * Back" filter has something to actually filter and the toggle leaves its
 * disabled-while-loading state.
 */
const FAKE_FOLLOWERS_PAGED = {
  collection: [
    {
      id: 200,
      username: "testfollowing1",
      avatar_url: null,
      followers_count: 100,
      track_count: 10,
      permalink_url: "https://soundcloud.com/testfollowing1",
    },
  ],
  next_href: null as string | null,
};

/**
 * `GET /api/reposts/paged` — offset-paged, so the shape is `has_more` rather
 * than a cursor. One playlist among the tracks, because the repost row
 * renders a different badge and fallback icon per `resourceType` and an
 * audit that only ever saw tracks would miss half the row.
 */
const FAKE_REPOSTS_PAGED = {
  collection: Array.from({ length: 4 }, (_, i) => ({
    id: 300 + i,
    urn: `soundcloud:tracks:${300 + i}`,
    resourceType: i === 1 ? "playlist" : "track",
    title: `Sample Repost ${i + 1}`,
    user: { username: "testartist" },
    artwork_url: null as string | null,
    permalink_url: `https://soundcloud.com/testartist/sample-repost-${i + 1}`,
    created_at: "2026-09-01T12:00:00.000Z",
  })),
  has_more: false,
  total: 4,
};

/** What `POST /api/feedback` answers with on a 201 — id and timestamp only. */
const FAKE_FEEDBACK_CREATED = {
  id: "fb_1",
  createdAt: "2026-09-22T12:00:00.000Z",
};

/** `GET /api/feedback/mine` — empty, so the "Your recent reports" list stays
 *  out of the way of the submit flow under test. */
const FAKE_FEEDBACK_MINE = { items: [] as unknown[] };

/**
 * A stand-in for `GET /api/auth/export`. Shaped like the real payload's
 * envelope but with one obviously-fake row per collection — the account page
 * only navigates to this route, so nothing renders it.
 */
const FAKE_EXPORT = {
  schemaVersion: 1,
  generatedAt: "2026-09-22T12:00:00.000Z",
  user: {
    id: "u1",
    soundcloudId: 1000001,
    username: "testuser",
    displayName: "Test User",
    avatarUrl: null as string | null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: "2026-09-22T11:00:00.000Z",
  },
  token: { expiresAt: "2026-09-23T11:00:00.000Z" },
  operationLogs: [] as unknown[],
  growthActions: [] as unknown[],
  feedback: [] as unknown[],
  rebrandVotes: [] as unknown[],
  surveyResponses: [] as unknown[],
  betaSignups: [] as unknown[],
  libraryCacheState: [] as unknown[],
  libraryCachePages: [] as unknown[],
};

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
    if (method === "GET" && path === "/api/playlists") {
      return route.fulfill(json(FAKE_PLAYLISTS));
    }
    if (method === "GET" && path === "/api/likes/paged") {
      return route.fulfill(json(FAKE_LIKES_PAGED));
    }
    if (method === "GET" && (path === "/api/followings/paged" || path === "/api/followings")) {
      return route.fulfill(json(FAKE_FOLLOWINGS_PAGED));
    }
    if (method === "GET" && (path === "/api/followers/paged" || path === "/api/followers")) {
      return route.fulfill(json(FAKE_FOLLOWERS_PAGED));
    }
    if (method === "GET" && path === "/api/reposts/paged") {
      return route.fulfill(json(FAKE_REPOSTS_PAGED));
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

    // ── Account page (see e2e/account.spec.ts) ──
    // The real route answers with `Content-Disposition: attachment`, so the
    // browser saves the file instead of navigating; keep that here, otherwise
    // the click would replace the page under the rest of the test.
    if (method === "GET" && path === "/api/auth/export") {
      return route.fulfill({
        ...json(FAKE_EXPORT),
        headers: {
          "content-type": "application/json",
          "content-disposition":
            'attachment; filename="track-toolkit-export-2026-09-22.json"',
        },
      });
    }
    if (method === "POST" && path === "/api/auth/disconnect") {
      return route.fulfill(json({ success: true }));
    }
    if (method === "DELETE" && path === "/api/auth/account") {
      return route.fulfill(json({ success: true }));
    }

    // eslint-disable-next-line no-console
    console.warn(`[e2e mockApi] unhandled ${method} ${path} — returning {} 200`);
    return route.fulfill(json({}));
  });
}
