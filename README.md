# SoundCloud Toolkit _(soundcloud-toolkit)_

A web toolkit for SoundCloud power users to organize playlists, likes, and metadata — with secure OAuth, fast UI, and privacy-first sessions.

[![Standard Readme compliant](https://img.shields.io/badge/readme-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey.svg)](#license)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2018-43853d.svg)](#install)
[![React](https://img.shields.io/badge/react-18-61dafb.svg)](#install)
[![Vite](https://img.shields.io/badge/build-vite-646cff.svg)](#install)

## Table of Contents

- [Security](#security)
- [Background](#background)
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
- Avoid committing secrets: `.env*` is ignored; ship **.env.example** for setup.

## Background

**SoundCloud Toolkit** streamlines common power‑user tasks:

- **Merge playlists** into a new one (dedupe, cap 500 tracks).
- **Likes → Playlist** (batch creation, up to 500 tracks).
- **Reorder / remove** tracks in an existing playlist and push the new order.
- **Resolve any SoundCloud link** (track / playlist / user) to normalized metadata.
- **Session‑based auth** with secure, `HttpOnly` cookies.

### Tech Stack

- **Frontend:** React 18, Vite, React Router, TailwindCSS (minimal custom styling), Framer Motion, Lucide icons.
- **Backend:** Node.js + Express, CORS, cookie‑session.
- **DB:** Prisma ORM with PostgreSQL (Neon recommended).
- **SoundCloud API:** OAuth2 with PKCE, token refresh, REST endpoints.
- **Crypto:** AES‑256‑GCM for token encryption at rest.

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
npm run server

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

- **Frontend:** Vercel (Vite preset). Set `VITE_API_BASE` to your API origin.
- **Backend:** Render Web Service (`node server/index.js`). Set server env vars.
- **DB:** Neon (pooled connection string recommended).
- **Domains:**
  - Frontend → `www.yourdomain.com`
  - API → `api.yourdomain.com`
  - SoundCloud Redirect URI → `https://api.yourdomain.com/api/auth/callback`

### Notable Behaviors & Limits

- Playlist updates capped at **500 tracks** (SoundCloud).
- Likes pagination uses cursor/linked partitioning.
- Basic backoff for **429** rate limits.
- **401** auto‑retry path will refresh access tokens where applicable.
- Cross‑site cookies require **HTTPS** + `SameSite=None` and strict **CORS** allowlist.
- “Smart Deduplication” UI exists; server smart‑dedup route may be disabled/commented in some builds.

## API

### Auth Flow (server‑side)

- **GET `/api/auth/login`**  
  Generates PKCE verifier/challenge, sets `pkce_verifier` (HttpOnly) and `app_url` cookies, redirects to SoundCloud authorize.
- **GET `/api/auth/callback`**  
  Exchanges `code` + PKCE verifier for tokens, fetches `/me`, encrypts tokens, upserts `User` + `Token`, signs a `session` cookie, redirects to dashboard.
- **POST `/api/auth/logout`**  
  Clears session cookie.
- **GET `/api/auth/me`**  
  Returns session payload (id/username/avatar/displayName).

### Selected Endpoints

- **GET `/api/me`** — proxy of SoundCloud `/me` for the signed‑in user.
- **GET `/api/playlists?limit&offset`** — list user playlists (normalized cover art).
- **GET `/api/playlists/:id`** — playlist with tracks (normalized).
- **PUT `/api/playlists/:id`** — overwrite order/title by sending full `tracks` list.
- **POST `/api/playlists/merge`** — merge multiple playlists into a new one.
- **POST `/api/playlists/from-likes`** — create playlist from selected Like IDs (batched PUTs).
- **GET/POST `/api/likes/paged`** — cursor‑based likes pagination.
- **GET/POST `/api/resolve`** — resolve any SoundCloud URL to normalized entity (track / playlist / user).

### Data Model (Prisma)

- **User**: `id (cuid)`, `soundcloudId (unique)`, `username`, `displayName?`, `avatarUrl?`, timestamps  
- **Token**: `id (cuid)`, `userId (unique)`, `encrypted` (access), `refresh` (token), `expiresAt`, timestamps  
- **Provider:** PostgreSQL (`provider = "postgresql"`) with `DATABASE_URL`

## Maintainers

- [@cole-hackman](https://github.com/cole-hackman)

## Contributing

Questions? Open an [issue](https://github.com/cole-hackman/soundcloud-toolkit/issues).  
Pull requests are welcome — please keep changes focused, documented, and tested where feasible.  
If your change affects parsing or API contracts, include (sanitized) examples.

## License

**UNLICENSED**. SEE LICENSE IN `LICENSE` (add a license file to clarify usage and contributions).
