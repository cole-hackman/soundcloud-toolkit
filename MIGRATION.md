# Azure migration — working state

Durable state for the DigitalOcean + Vercel + Neon → Azure move and the
tracktoolkit.com domain switch. A fresh session resumes from this file plus
`git log`. Companion documents: `infra/README.md` (operator reference),
`docs/azure-db-cutover.md` (the rehearsed database procedure).

Started 2026-09-19 (overnight run) on branch `azure/migration`, which is
branched from `claude/keen-newton-02qlh4` (the rebrand commit, draft PR #39).
Nothing here touches production: DigitalOcean, Vercel, Neon and DNS are
untouched and remain the rollback plan.

## Status at a glance

| # | Work item | State |
|---|---|---|
| 1 | Provision Azure in parallel, /health 200 | in progress |
| 2 | Rehearse the database migration, write docs/azure-db-cutover.md | in progress |
| 3 | Secrets reachable? decrypt round-trip | in progress |
| 4 | prep/domain-switch branch + 301 design | not started |
| 5 | Verification (tests, tsc, lint, build, login redirect) | not started |
| 6 | Fix CLAUDE.md cookie-domain error | **done** (commit on this branch) |

## Resources (Azure subscription "Azure subscription 1", 14ca6838-…)

| Resource | Name / host | Notes |
|---|---|---|
| Resource group | `rg-tracktoolkit` | `westus3` |
| App Service plan | `tracktoolkit-plan` | Linux B1, capacity 1 pinned |
| Web app | `tracktoolkit` → https://tracktoolkit.azurewebsites.net | Node 22 LTS, `node server/index.js`, health `/health` |
| Postgres | `tracktoolkit-pg.postgres.database.azure.com` | Flexible Server PG17, B1ms, admin `tracktoolkit_admin` (password in Key Vault `postgres-admin-password`) |
| Databases | `tracktoolkit` (empty, prod-to-be), `tracktoolkit-rehearsal` (throwaway) | |
| Key Vault | `tracktoolkit-kv` | RBAC; secret names listed in `infra/deploy.sh` |
| Log Analytics | `tracktoolkit-logs` | |
| Entra app for GitHub OIDC | `gh-tracktoolkit-deploy` (appId 8b48e1d8-…) | federated subject `repo:cole-hackman/soundcloud-toolkit:environment:azure`, Website Contributor on the RG |
| GitHub | environment `azure`; variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | |

Current production for reference: DigitalOcean app `sctoolkit-backend`
(69dbca20-…, region sfo, size apps-s-1vcpu-0.5gb, API-only — it does not
build the frontend), Vercel project `soundcloud-tool`, Neon project
`SoundCloud-Toolkit` (mute-recipe-09351558, PG 17.11, 485 MB, us-west-2).
Note `.do/app.yaml` says the app is called `soundcloud-toolkit-api`; the live
app is `sctoolkit-backend` with service `soundcloud-toolkit`.

## Work item 1 — Azure provisioning

### Decision: App Service, not Container Apps

App Service (Linux, B1, one instance) because:

- It matches what DigitalOcean App Platform does today: a Node runtime, a
  start command, a health check, no Dockerfile and no registry to maintain.
- **A single instance is the default, not something to defend.** Basic tier
  has no autoscale rules; `elasticScaleEnabled: false` keeps the newer
  automatic scaling off; `capacity: 1` is pinned in `infra/main.bicep` with a
  comment pointing at the invalidation-mark header in
  `server/lib/social-cache.js`. Container Apps scales on HTTP concurrency by
  default and would need `minReplicas = maxReplicas = 1` plus a note for
  anyone who "helpfully" raises it.
- Health-check restarts, managed TLS certificates for custom domains, Key
  Vault references in app settings and Log Analytics wiring are built in.
- Cost is comparable: B1 is about $13/month; a Container Apps replica held at
  one always-on instance lands in the same range and adds a registry.

What it costs: cold deploys take a minute or two to swap in, and the B1 box
has 1.75 GB RAM, so the frontend is built in GitHub Actions rather than on the
box (`SCM_DO_BUILD_DURING_DEPLOYMENT=false`).

### Decision: same origin (Express serves `frontend-UI/out`), not Static Web Apps

`server/index.js` already serves the static export when the directory
exists, so this is zero code. What it buys:

- The session cookie can drop from `SameSite=None` to `Lax`
  (`SESSION_COOKIE_SAMESITE=lax`, added on this branch, default unchanged).
  The browser then never attaches it to a cross-site request, which removes
  the whole class of CSRF that `rejectUntrustedOrigin` and the JSON-only body
  parser currently defend against. Both defenses stay.
- The CORS / Origin allowlist collapses to one origin instead of five.
- The OAuth redirect URI loses the `api.` subdomain
  (`https://tracktoolkit.com/api/auth/callback`).
- One host, one certificate, one deploy.

The tradeoff: static assets are served by Express from the app box instead of
a CDN edge. For this traffic (thousands of users, not millions) that is fine;
`express.static` sends ETags and a one-day max-age. If it ever matters, Azure
Front Door in front of the same app fixes it without changing the origin
model. The personal Chrome extension (`CHROME_EXTENSION_IDS`) does credentialed
cross-origin fetches; under `Lax` those lose the cookie. It is sideloaded and
personal, so that is accepted and noted here rather than designed around.

### Region

`westus2` (closest to the current sfo/us-west-2 stack) has **no Burstable
Postgres capacity for this subscription** (`list-skus` returns an empty
version list). Everything was moved to `westus3`, which offers B1ms with PG
11–18. The first westus2 deployment was deleted and the soft-deleted vault
purged so the names could be reused.

### Deployment pipeline

`.github/workflows/azure-deploy.yml`, manual trigger. Builds on Linux (Prisma
engine must match the App Service image), runs `npm test`, builds the static
export, zips `server/ prisma/ node_modules/ frontend-UI/out` and ships it with
OIDC (no stored secret). When the cutover is done, add `push: [main]`.

### Verification

(pending — filled in below when /health answers)

## Work item 2 — Database rehearsal

Source measurement (Neon, direct endpoint, `psql`, 2026-09-19 21:28 CEST):
PostgreSQL 17.11, 485 MB, row counts in 9 s:

| table | rows |
|---|---|
| beta_signups | 235 |
| chat_conversations | 19 |
| chat_messages | 75 |
| growth_actions | 6220 |
| indexed_likes | 1021 |
| indexed_playlist_tracks | 1242 |
| library_cache_pages | 901 |
| library_cache_states | 401 |
| library_snapshots | 1 |
| operation_logs | 22091 |
| playlists | 3882 |
| rebrand_votes | 378 |
| survey_responses | 320 |
| tokens | 4089 |
| tracks | 576427 |
| users | 4089 |

(remaining steps pending)

## Work item 3 — Secrets

**Readable.** The DigitalOcean MCP (`apps-get-info`) returns every env var
of `sctoolkit-backend` in plaintext, including `ENCRYPTION_KEY`,
`SESSION_SECRET`, `SOUNDCLOUD_CLIENT_SECRET` and the Neon `DATABASE_URL`.
They are not typed as `SECRET` in the DigitalOcean spec, which is why the API
hands them back. The values are **not** written anywhere in this repo; they
go into `tracktoolkit-kv` under the names in `infra/deploy.sh`, and the app
settings reference them, so nothing changes in code at cutover.

The root `.env` on this machine holds the same `DATABASE_URL` host and both
secrets by name; whether its values match production is settled by the
decrypt round-trip below, not by comparing files.

(decrypt round-trip pending)

## Work item 4 — Domain switch

(not started)

## Work item 5 — Verification

(not started)

## Work item 6 — CLAUDE.md cookie domain

Done. `createSessionCookieOptions()` sets no `domain`; the cookie is host-only
on `api.soundcloudtoolkit.com` and crosses to `www.` only through
`SameSite=None; Secure`. Both places in CLAUDE.md that claimed
`Domain=.soundcloudtoolkit.com` (the cookie table and "Domain Strategy") now
say so.

## Blocked

(nothing yet)

## Follow-ups (not done tonight, deliberately)

- **DigitalOcean env vars are readable through the API.** Every secret on
  `sctoolkit-backend` is a plain env, not `type: SECRET`. Anyone with the
  DigitalOcean token can read the token-encryption key. Mark them SECRET (or
  just decommission the app after cutover) and rotate `SOUNDCLOUD_CLIENT_SECRET`
  at SoundCloud once the old stack is gone.
- `.do/app.yaml` drifted from the live app (name, service name, missing
  `DOWNLOAD_ALLOWLIST`, `ADMIN_IDS`, `NODE_ENV`). Irrelevant after cutover.
- `DOWNLOAD_ALLOWLIST` and `ADMIN_IDS` exist in production but
  `DOWNLOAD_ALLOWLIST` is undocumented in CLAUDE.md's env table.
- Postgres reachability is public + "Allow Azure services" firewall rule.
  Move to a private endpoint / VNet integration once live.
- `.github/workflows/keep-api-warm.yml` pings the DigitalOcean host every 5
  minutes; retire or repoint after cutover (App Service `alwaysOn` makes it
  unnecessary).
- README says the catalog holds 2,032,233 tracks; the live `tracks` table has
  576,427 rows. Re-measure before quoting it again.
