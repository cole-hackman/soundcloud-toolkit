# SoundCloud Toolkit _(soundcloud-toolkit)_

A web toolkit for SoundCloud power users — organize playlists, manage followers, bulk-unlike, download tracks, and clean up your library with secure OAuth, a fast React UI, and privacy-first sessions.

[![Standard Readme compliant](https://img.shields.io/badge/readme-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey.svg)](#license)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2018-43853d.svg)](#install)
[![React](https://img.shields.io/badge/react-18-61dafb.svg)](#install)
[![Vite](https://img.shields.io/badge/build-vite-646cff.svg)](#install)

## Table of Contents

- [Security](#security)
- [Background](#background)
- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Security

- **OAuth2 + PKCE** with the official SoundCloud flow. No credential storage in the frontend.
- **Session cookie** is HMAC‑signed (`SESSION_SECRET`), `HttpOnly`, `Secure`, `SameSite=None` in production.
- **Access/refresh tokens** are **encrypted at rest** using **AES‑256‑GCM** with a 32‑char `ENCRYPTION_KEY`.
- **CORS allowlist** via `APP_URLS`; cookies require HTTPS and same eTLD+1 for reliability.
- **Rate limiting** on heavy operations (merge, batch resolve, bulk unlike/unfollow).
- **Input validation** on all API routes via `express-validator`.
- **Helmet** security headers in production.
- Avoid committing secrets: `.env*` is ignored; ship **.env.example** for setup.

## Background

**SoundCloud Toolkit** goes far beyond what the native SoundCloud app offers, giving power users 10+ tools to manage every aspect of their library — playlists, likes, followers, downloads, and more.

### Tech Stack

| Layer        | Technologies                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| **Frontend** | React 18, Vite, React Router, Framer Motion, Lucide icons, Vercel Analytics                          |
| **Backend**  | Node.js, Express, Helmet, CORS, cookie-based sessions, rate limiting                                 |
| **Database** | Prisma ORM + PostgreSQL (Neon recommended)                                                           |
| **Auth**     | SoundCloud OAuth2 + PKCE, AES-256-GCM token encryption                                               |
| **SEO**      | JSON-LD structured data (Organization, SoftwareApplication, FAQPage), Open Graph & Twitter Card meta |

## Features

### 🎵 Playlist Management

- **Combine Playlists** — Merge multiple playlists into one, with automatic duplicate detection and removal. Auto-splits into parts when exceeding the 500-track SoundCloud limit.
- **Playlist Modifier** — Reorder tracks via drag-and-drop, remove unwanted songs, and apply smart sorting by title, artist, date, duration, or BPM. Push the updated order back to SoundCloud.
- **Playlist Health Check** — Scan playlists for blocked, deleted, or unstreamable tracks. Clean up dead entries to keep playlists in perfect shape.

### ❤️ Likes & Activity

- **Likes → Playlist** — Convert your liked tracks into curated playlists. Select from thousands of favorites and batch-create playlists with custom names.
- **Activity to Playlist** — Capture recently posted tracks from your activity feed (artists you follow) and save them as a playlist before they get buried.
- **Like Manager** — Browse, search, and bulk unlike tracks. Clean up thousands of stale likes in seconds.

### 👥 Social Management

- **Following Manager** — See who doesn't follow you back, filter and search your followings list, and bulk unfollow accounts to clean up your social graph.

### 🔗 Link & Metadata Tools

- **Link Resolver** — Resolve any SoundCloud URL (track, playlist, or user) to normalized metadata instantly.
- **Batch Link Resolver** — Paste multiple SoundCloud URLs and resolve them all at once with in-memory caching (5-minute TTL).

### ⬇️ Downloads

- **Proxy Downloads** — Download tracks where the artist has enabled downloads or provided a purchase link. Downloads are proxied through the backend for reliable delivery.

### 🎨 UI & Accessibility

- **Dark / Light Theme** — System-aware theme toggle persisted in local storage.
- **Responsive Design** — Works on desktop, tablet, and mobile.
- **Animated UI** — Smooth transitions and micro-animations via Framer Motion.

## Install

**Requirements**

- Node.js **18+** and npm (or pnpm/yarn)
- PostgreSQL DB (e.g., Neon) or local dev DB

```bash
git clone https://github.com/cole-hackman/soundcloud-toolkit
cd soundcloud-toolkit
npm install
```

Create **.env** (server) and optionally **.env.local** (frontend). Example:

```bash
# --- Server (.env) ---
SOUNDCLOUD_CLIENT_ID=your_client_id
SOUNDCLOUD_CLIENT_SECRET=your_client_secret
SOUNDCLOUD_REDIRECT_URI=https://api.yourdomain.com/api/auth/callback
SESSION_SECRET=super_long_random_string
ENCRYPTION_KEY=32characterslongexactly32characters!
DATABASE_URL=postgres://...-pooler.../neondb?sslmode=require&pgbouncer=true&connection_limit=1&connect_timeout=15
APP_URL=https://www.yourdomain.com
APP_URLS=https://www.yourdomain.com,https://api.yourdomain.com

# --- Frontend (.env.local) ---
VITE_API_BASE=https://api.yourdomain.com
```

Initialize the DB schema:

```bash
npx prisma db push
# or
npx prisma migrate dev
```

## Usage

### Local Development

```bash
# start frontend (Vite)
npm run dev

# start backend (Express on 3001)
npm run dev:server

# run both concurrently
npm run dev:full
```

Visit **http://localhost:5173** → **Login with SoundCloud**.

### Build & Preview

```bash
npm run build
npm run preview
```

### Deployment Pattern (example)

| Component               | Recommendation                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Frontend**            | Vercel (Vite preset). Set `VITE_API_BASE` to your API origin.                                              |
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
