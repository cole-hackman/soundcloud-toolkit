# SoundCloud Toolkit _(soundcloud-toolkit)_

A web toolkit for SoundCloud power users — organize playlists, manage followers, bulk-unlike, download tracks, and clean up your library with secure OAuth, a fast React UI, and privacy-first sessions.

[![Standard Readme compliant](https://img.shields.io/badge/readme-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey.svg)](#license)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2018-43853d.svg)](#install)
[![React](https://img.shields.io/badge/react-18-61dafb.svg)](#install)
[![Next.js](https://img.shields.io/badge/next-15-black.svg)](#install)

## 1. What Is the Project?

**SoundCloud Toolkit** is a web application designed for SoundCloud power users. It provides advanced tools to organize playlists, manage followers, bulk-unlike tracks, proxy downloads, and clean up your library using secure OAuth and a fast modern UI.

## 2. Why Was This Project Built?

Managing a large SoundCloud library natively can be tedious and restrictive. Power users often struggle with organizing massive playlists, cleaning up thousands of old likes, or seeing who isn't following them back. Important tracks get buried, and managing a social graph is difficult. SoundCloud Toolkit centralizes these advanced management features into one simple interface, providing capabilities that go far beyond what the native app offers.

## 3. What Problems Did It Solve?

One major challenge was dealing with SoundCloud's strict 500-track limit for playlists when users attempted to merge multiple large playlists. This was solved by implementing an algorithm that automatically detects the track count during a merge and intelligently splits the merged result into numbered, sequential playlist parts (e.g., "Merged Playlist pt. 1", "Merged Playlist pt. 2") while removing duplicates.

Another challenge was handling API rate limits during bulk operations like unliking or unfollowing. This was addressed by implementing rate limiting on the backend, processing requests in batches, and using cursor-based linked partitioning for reliable pagination of large libraries.

## 4. What Technologies Are Used?

- **Frontend**: Next.js 15, React 18, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express.js, Helmet, CORS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: SoundCloud OAuth2 + PKCE, AES-256-GCM token encryption
- **Deployment**: Vercel (frontend), Render / Railway (backend)

## 5. What Did You Implement?

- **Playlist Management**: Combine multiple playlists, auto-split large playlists, remove duplicates, health-check playlists for dead tracks, clone any public playlist, and securely transfer/copy/duplicate tracks across your playlists.
- **Likes & Activity**: Convert liked tracks to playlists, batch unlike tracks, and capture recent activity feeds into playlists.
- **Social & Profile Management**: Identify non-followers, bulk unfollow accounts to clean up your social graph, and batch unrepost content from your profile.
- **Link & Metadata Tools**: Resolve any SoundCloud URL (track, playlist, or user) to normalized metadata instantly, with batching and in-memory caching.
- **Secure Authentication**: End-to-end OAuth flow with AES-256-GCM token encryption and CSRF-protected HttpOnly cookies.

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
| `/api/playlists/transfer-track` | POST     | Move or duplicate a single track across the user's playlists            |
| `/api/playlists/from-likes`     | POST     | Create playlist from selected like IDs (batched PUTs)                   |
| `/api/likes`                    | GET      | All user likes                                                          |
| `/api/likes/paged`              | GET      | Cursor-based likes pagination                                           |
| `/api/likes/tracks/bulk-unlike` | POST     | Bulk unlike tracks by ID list                                           |
| `/api/resolve`                  | GET/POST | Resolve any SoundCloud URL to normalized entity (track/playlist/user)   |
| `/api/resolve/batch`            | POST     | Batch resolve multiple SoundCloud URLs with caching                     |
| `/api/proxy-download`           | GET      | Proxy track download through the backend                                |
| `/api/activities`               | GET      | User activity feed (recent tracks from followed artists)                |
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
