# SoundCloud Toolkit _(soundcloud-toolkit)_

A web toolkit for SoundCloud power users — organize playlists, browse public libraries from people you follow, manage followers, bulk-unlike, download tracks, and clean up your library with secure OAuth, a fast React UI, and privacy-first sessions.

Live at https://soundcloudtoolkit.com — 2,200+ registered users, processing 360K+ tracks/month, with zero paid acquisition.

[![Standard Readme compliant](https://img.shields.io/badge/readme-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey.svg)](#license)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2018-43853d.svg)](#install)
[![React](https://img.shields.io/badge/react-18-61dafb.svg)](#install)
[![Next.js](https://img.shields.io/badge/next-15-black.svg)](#install)

## 1. What Is the Project?

**SoundCloud Toolkit** is a web application designed for SoundCloud power users. It provides advanced tools to organize playlists, browse public likes and playlists from followed users, manage followers, bulk-unlike tracks, proxy downloads, and clean up your library using secure OAuth and a fast modern UI.

## 2. Why Was This Project Built?

Managing a large SoundCloud library natively can be tedious and restrictive. Power users often struggle with organizing massive playlists, cleaning up thousands of old likes, or seeing who isn't following them back. Important tracks get buried, and managing a social graph is difficult. SoundCloud Toolkit centralizes these advanced management features into one simple interface, providing capabilities that go far beyond what the native app offers.

## 3. What Problems Did It Solve?

SoundCloud Toolkit fills the gaps that the native SoundCloud website and mobile apps leave open for users with large libraries and active social graphs. Each feature targets a specific shortcoming of the native experience:

- **No native way to combine playlists.** SoundCloud doesn't offer a "merge" button — users have to manually re-add hundreds of tracks one by one. SoundCloud Toolkit lets users pick any number of playlists and combine them into one (or several, when the result exceeds the 500-track ceiling) in a single click.
- **No way to bulk-unlike tracks.** Natively, every "unlike" is a single click on a single track. Cleaning up thousands of accumulated likes is realistically impossible. The toolkit provides a paginated like manager with multi-select and bulk-unlike.
- **No way to bulk-unfollow users.** Same story for the social graph — users who want to trim their followings list down from hundreds or thousands of accounts can do it in a single batch operation.
- **No way to bulk-remove reposts.** Reposts pile up on a user's profile and there's no native cleanup tool. The toolkit lists reposts and lets users remove them in bulk.
- **No way to turn liked tracks into a playlist.** Likes and playlists are separate concepts on SoundCloud, with no built-in conversion. The toolkit lets users pick any subset of their likes and spin them into a new playlist.
- **No way to capture the activity feed.** Recent uploads from followed artists scroll off into oblivion. The toolkit lets users convert recent activity into a saved playlist before it's gone.
- **No playlist health checker.** Tracks go private, get DMCA'd, or become region-blocked, and SoundCloud silently leaves them in playlists as dead entries. The toolkit scans playlists for blocked and unstreamable tracks so users can clean them out.
- **No easy way to browse a followed user's library in bulk.** The native UI makes it awkward to see what someone you follow has liked or curated; the toolkit surfaces a followed user's public likes and playlists in one place and lets you clone interesting playlists or build a new one from their likes.
- **No structured URL resolver.** Sharing or scripting against SoundCloud requires knowing whether a URL is a track, playlist, or user — and SoundCloud doesn't expose this directly. The toolkit's resolver normalizes any SoundCloud URL into clean metadata, with batch support.
- **The 500-track playlist cap is invisible until you hit it.** Rather than failing, the toolkit detects when a merge or likes-to-playlist conversion would exceed the cap and transparently splits the output into numbered parts.

## 4. What Technologies Are Used?

- **Frontend**: Next.js 15, React 18, Tailwind CSS 3, shadcn/ui
- **Backend**: Node.js, Express.js, Helmet, CORS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: SoundCloud OAuth2 + PKCE, AES-256-GCM token encryption
- **Deployment**: Vercel (frontend), DigitalOcean App Platform (backend)

## 5. What Did You Implement?

The toolkit is a full-stack application: a Next.js 15 / React 18 frontend deployed as a static export on Vercel, and an Express.js backend that acts as a secure OAuth2 proxy in front of the SoundCloud API. All SoundCloud credentials live server-side — the browser only ever talks to the backend, and the backend signs every outbound SoundCloud request with the user's encrypted access token.

### Playlist Management

- **Combine Playlists** — `POST /api/playlists/merge` accepts 2–10 source playlist IDs. The backend fetches each source via `GET /playlists/:id` (with a 300ms delay between calls to avoid SoundCloud rate limits), filters out blocked and non-streamable tracks, deduplicates by track ID using a `Set`, and then creates one or more destination playlists via `POST /playlists` followed by batched `PUT /playlists/:id` calls in 100-track windows. If the deduplicated total exceeds 500, the result is automatically split into numbered parts (e.g. "Merge (1/3)") because SoundCloud enforces a hard 500-track cap per playlist.
- **Likes → Playlist** — `POST /api/playlists/from-likes` takes an array of track IDs the user has selected from their likes view and builds new playlists using the same auto-splitting batched-write pipeline as merge.
- **Activity → Playlist** — `GET /api/activities?limit=200` returns the user's normalized activity feed; the frontend filters to track activities, and the user can convert any subset into a playlist using the same from-likes endpoint.
- **Playlist Health Check** — `GET /api/playlists/:id` returns the full track list; the frontend identifies tracks with `blocked_at !== null` or `streamable === false`, and the user can save a cleaned version via `PUT /api/playlists/:id`.

### Likes, Social & Reposts

- **Like Manager** — `GET /api/likes/paged?limit=50&next=<cursor>` paginates likes using SoundCloud's cursor URLs. `POST /api/likes/tracks/bulk-unlike` accepts up to 100 track IDs per request and iterates `DELETE /me/likes/tracks/:id` on each one, returning per-track success/failure status.
- **Following Manager** — `GET /api/followings` fully paginates the user's followings, and `POST /api/followings/bulk-unfollow` runs `DELETE /me/followings/:id` for each selected user, again capped at 100 per request.
- **Reposts Cleanup** — `GET /api/reposts` uses a fallback chain (V2 `/stream/users/:id/reposts`, falling back to V1 `/me/activities` filtered to repost types) because SoundCloud's reposts API is inconsistent. `POST /api/reposts/bulk-remove` un-reposts each item.

### URL Resolution & Downloads

- **Resolve** — `GET /api/resolve?url=...` and `POST /api/resolve/batch` sanitize incoming URLs (stripping `utm_*` / `si` params, validating the `soundcloud.com` domain), then call SoundCloud's authenticated `/resolve` endpoint with a fallback to the public `resolve` endpoint. Responses are normalized into `{ id, type, title, user, artwork_url, downloadable }` and cached in-memory for 5 minutes.
- **Proxy Download** — `GET /api/proxy-download?url=...` validates that the URL matches `api.soundcloud.com/tracks/:id/download`, attaches the user's OAuth token, follows SoundCloud's 302 redirect, validates that the final CDN host is `sndcdn.com`, `cloudfront.net`, or `soundcloud.com`, and redirects the browser to the CDN so the file streams directly.

### Authentication

OAuth2 + PKCE end-to-end: `GET /api/auth/login` generates a verifier with `crypto.randomBytes(32)` and a SHA-256 challenge, stores the verifier in a 10-minute HttpOnly cookie, and redirects to SoundCloud. `GET /api/auth/callback` exchanges the code for tokens, encrypts them with AES-256-GCM (`12-byte IV | 16-byte GCM tag | ciphertext`), stores them in Postgres via Prisma, and issues an HMAC-SHA256-signed session cookie. Access tokens are auto-refreshed inside the SoundCloud client wrapper whenever a request returns 401, transparently to the caller.

### In Progress: AI Library Chat

**Note: this feature lives on the `feature/ai-library-chat` branch and is not on `main`.** A conversational interface over the user's library is being built out there. The backend maintains a per-user search index in Postgres — `LibrarySnapshot`, `IndexedLike`, and `IndexedPlaylistTrack` tables populated by `server/lib/library-index.js#syncLibrary`. `POST /api/library/sync` kicks off an async reindex from SoundCloud, and `GET /api/library/snapshot` reports freshness and a `stale` flag so the frontend can prompt for a refresh. `POST /api/chat` opens a server-sent-events stream that runs an OpenAI tool-calling loop: the model can query the index (with a live SoundCloud fallback) using tools defined in `server/lib/chat-tools.js`, and write actions (creating playlists, bulk-unliking, etc.) are surfaced to the frontend as confirm-in-UI proposals rather than executed silently. The chat endpoint streams `token`, `tool_status`, `tool_result`, `done`, and `error` events, and is rate-limited at 30 requests per hour. OpenAI access is isolated in `server/lib/chat-provider.js` to keep the provider swappable. The UI lives at `frontend-UI/src/app/(app)/library-chat/page.tsx` with a floating launcher component for cross-app access.

## 6. How Can Someone Run It Locally?

**Requirements**

- Node.js **18+** and npm (or pnpm/yarn)
- PostgreSQL DB (e.g., Neon) or local dev DB

```bash
git clone https://github.com/cole-hackman/soundcloud-toolkit
cd soundcloud-toolkit
npm install
```

Create **.env** (server) and **frontend-UI/.env.local** (frontend). Example:

```bash
# --- Server (.env) ---
SOUNDCLOUD_CLIENT_ID=your_client_id
SOUNDCLOUD_CLIENT_SECRET=your_client_secret
SOUNDCLOUD_REDIRECT_URI=https://api.yourdomain.com/api/auth/callback
SESSION_SECRET=super_long_random_string
ENCRYPTION_KEY=32characterslongexactly32characters!
DATABASE_URL=postgres://...
APP_URL=http://localhost:3000
APP_URLS=http://localhost:3000,http://localhost:3001

# --- Frontend (frontend-UI/.env.local) ---
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

Initialize the DB schema:

```bash
npx prisma db push
```

**Start the development servers:**

```bash
# Run both frontend (Next.js) and backend (Express) concurrently
npm run dev
```

Visit **http://localhost:3000** → **Login with SoundCloud**.

### Build & Preview

```bash
npm run build
npm run server
```

### Deployment Pattern (example)

| Component               | Recommendation                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Frontend**            | Vercel (Next.js preset). Set `NEXT_PUBLIC_API_BASE` to your API origin.                                   |
| **Backend**             | DigitalOcean App Platform (see `.do/app.yaml` and `DIGITALOCEAN_MIGRATION.md`), Render, Railway, or Fly.io |
| **Database**            | Neon (pooled connection string recommended)                                                                |
| **Domains**             | Frontend → `www.yourdomain.com`, API → `api.yourdomain.com`                                                |
| **SoundCloud Redirect** | `https://api.yourdomain.com/api/auth/callback`                                                             |

### Notable Behaviors & Limits

- Playlist updates capped at **500 tracks** (SoundCloud limit); auto-splits into numbered parts for larger merges.
- Likes pagination uses cursor/linked partitioning for reliable paging of large libraries.
- Following Library can only copy public/API-visible resources from users you already follow; private, hidden, blocked, or non-streamable content is skipped or reported as unavailable.
- Basic backoff for **429** rate limits.
- **401** auto-retry path will refresh access tokens where applicable.
- Cross-site cookies require **HTTPS** + `SameSite=None` and strict **CORS** allowlist.
- Resolve results are cached in-memory for 5 minutes to reduce API calls.

## API

### Auth Flow (server-side)

| Endpoint             | Method | Description                                                                                                         |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/login`    | GET    | Generates PKCE verifier/challenge, sets `pkce_verifier` and `app_url` cookies, redirects to SoundCloud authorize    |
| `/api/auth/callback` | GET    | Exchanges `code` + PKCE verifier for tokens, encrypts and stores them, signs session cookie, redirects to dashboard |
| `/api/auth/logout`   | POST   | Clears session cookie                                                                                               |
| `/api/auth/me`       | GET    | Returns session payload (id, username, avatar, displayName)                                                         |

### Data Endpoints

| Endpoint                        | Method   | Description                                                             |
| ------------------------------- | -------- | ----------------------------------------------------------------------- |
| `/api/me`                       | GET      | Proxy of SoundCloud `/me` for the signed-in user                        |
| `/api/playlists`                | GET      | List user playlists (normalized cover art), supports `limit` & `offset` |
| `/api/playlists/:id`            | GET      | Single playlist with tracks (normalized)                                |
| `/api/playlists/:id`            | PUT      | Overwrite playlist order/title by sending full `tracks` list            |
| `/api/playlists/merge`          | POST     | Merge multiple playlists into a new one (dedupe, auto-split >500)       |
| `/api/playlists/clone`          | POST     | Clones an external public playlist to the user's account                |
| `/api/playlists/compare`        | POST     | Compare two playlists for overlap and missing tracks                    |
| `/api/playlists/transfer-track` | POST     | Move or duplicate a single track across the user's playlists            |
| `/api/playlists/from-likes`     | POST     | Create playlist from selected like IDs (batched PUTs)                   |
| `/api/library/audit`            | GET      | Audit playlists for duplicates, unavailable tracks, and download links  |
| `/api/likes`                    | GET      | All user likes                                                          |
| `/api/likes/paged`              | GET      | Cursor-based likes pagination                                           |
| `/api/likes/tracks/bulk-unlike` | POST     | Bulk unlike tracks by ID list                                           |
| `/api/followings/:userId/likes/paged` | GET | Browse public liked tracks for a followed user                          |
| `/api/followings/:userId/playlists/paged` | GET | Browse public playlists for a followed user                             |
| `/api/followings/:userId/liked-playlists/paged` | GET | Browse public liked playlists for a followed user                       |
| `/api/followings/:userId/likes/playlist` | POST | Create or append playlists from a followed user's public liked tracks   |
| `/api/followings/:userId/playlists/clone` | POST | Clone selected public playlists from a followed user                    |
| `/api/resolve`                  | GET/POST | Resolve any SoundCloud URL to normalized entity (track/playlist/user)   |
| `/api/resolve/batch`            | POST     | Batch resolve multiple SoundCloud URLs with caching                     |
| `/api/proxy-download`           | GET      | Proxy track download through the backend                                |
| `/api/activities`               | GET      | User activity feed (recent tracks from followed artists)                |
| `/api/tracks/search`            | GET      | Search playable tracks by genre, tags, text, BPM, and duration filters |
| `/api/followers`                | GET      | User's followers list                                                   |
| `/api/followings`               | GET      | User's followings list                                                  |
| `/api/followings/bulk-unfollow` | POST     | Bulk unfollow users by ID list                                          |
| `/api/reposts`                  | GET      | User's reposted tracks list                                             |
| `/api/reposts/debug`            | GET      | Tooling debug endpoint for analyzing repost data payload                |
| `/api/reposts/bulk-remove`      | POST     | Bulk remover for unreposting tracks by ID list                          |

### Data Model (Prisma)

| Model     | Fields                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| **User**  | `id (cuid)`, `soundcloudId (unique)`, `username`, `displayName?`, `avatarUrl?`, timestamps                     |
| **Token** | `id (cuid)`, `userId (unique)`, `encrypted` (access token), `refresh` (refresh token), `expiresAt`, timestamps |

Provider: PostgreSQL (`provider = "postgresql"`) with `DATABASE_URL`.

## Maintainers

- [@cole-hackman](https://github.com/cole-hackman)

## Contributing

Questions? Open an [issue](https://github.com/cole-hackman/soundcloud-toolkit/issues).  
Pull requests are welcome — please keep changes focused, documented, and tested where feasible.  
If your change affects parsing or API contracts, include (sanitized) examples.

## License

**UNLICENSED**. See `LICENSE` file for details.
