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
| 1 | Provision Azure in parallel, /health 200 | **resources up, code deployed**; /health is 500 until the six Key Vault secrets exist (Blocked B1) |
| 2 | Rehearse the database migration, write docs/azure-db-cutover.md | **done** — 16 min measured, `docs/azure-db-cutover.md` |
| 3 | Secrets reachable? decrypt round-trip | **done** — readable; 4089/4089 token rows decrypt with the DigitalOcean key |
| 4 | prep/domain-switch branch + 301 design | **done** (branch `prep/domain-switch`, 86b9d08, not merged, not pushed) |
| 5 | Verification (tests, tsc, lint, build, login redirect) | **done except login redirect** (needs B1) |
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

### Verification (2026-09-19, 21:27–21:50 CEST)

- `infra/deploy.sh` (Bicep) succeeded in `westus3`: every resource in the
  table above exists. Deployment name `tracktoolkit-20260919212721`.
- Code deployed with `az webapp deploy --type zip` (44 MB: `server/`,
  `prisma/`, production `node_modules` installed in a `node:22-bookworm`
  **amd64** container so the Prisma engine is `debian-openssl-3.0.x`, and
  `frontend-UI/out` from a green `next build`). App Service deployment log:
  "Deployment successful. deployer = OneDeploy" at 19:49:24 UTC.
- `GET https://tracktoolkit.azurewebsites.net/health` → **500** with body
  `{"error":"Server configuration error","message":"Server is not properly configured. Check environment variables."}`.
  That body is `validateEnv` in `server/middleware/security.js`, and the
  App Service log stream shows `[ERROR] Environment variable validation
  failed` every 5 s from the health probe — so the deployed Express app is
  running the shipped code; it is refusing to serve because the Key Vault
  references resolve to nothing (Blocked B1). The moment the six secrets
  exist and the app restarts, this is a 200. I could not get there tonight.
- First attempt on a Docker arm64 image produced a `linux-arm64` Prisma
  engine, which would not load on App Service (x64); the `--platform
  linux/amd64` rebuild fixed it. The GitHub workflow builds on x64 runners
  and does not have this problem.

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

Rehearsal run (all steps timed; full procedure, commands and rollback in
`docs/azure-db-cutover.md`):

| step | measured |
|---|---|
| Neon row counts (psql, direct endpoint) | 9 s |
| `pg_dump -Fc` Neon → 145 MB archive (Docker `postgres:17`) | 219 s |
| `pg_restore -j 4` into `tracktoolkit-rehearsal` (B1ms) | 671 s, 0 stderr lines |
| `docs/sql/2026-library-cache.sql` | 3 s (no-op: the dump already carries both tables) |
| Azure row counts + diff + structure | ~10 s |
| **downtime window** | **~16 min measured; budget 25, announce 30** |

Row counts: 15 of 16 tables identical; `operation_logs` was 22092 on Azure
against 22091 counted on Neon eleven minutes earlier, and 22093 on a recount
afterwards — live production writing between count and dump, which is
exactly what the freeze step in the procedure prevents. Structure matches:
16 tables, 63 indexes, 13 foreign keys, 0 sequences on both sides. Restored
size 408 MB (Neon reports 485 MB including its own overhead).

Two operational findings worth knowing before the real run:

- The Homebrew `libpq@17` `pg_dump` on this Mac hangs forever in the libpq
  connection poll against Neon (direct and pooler, with and without channel
  binding / GSS), while `psql` from the same keg connects instantly. Root
  cause not chased; the procedure uses `docker run postgres:17` for every
  client command, which worked first time and pins the client version.
- `library_cache_pages` (901 rows of large JSONB) is the restore's long
  tail, not `tracks` (576 k rows). If the window ever needs shrinking,
  that table is also safe to leave behind: the app treats it as a cache and
  rebuilds it (`snapshot-cache.js` fails soft).

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

**Decrypt round-trip: passed.** Against the restored `tokens` table in
`tracktoolkit-rehearsal`, with `ENCRYPTION_KEY` set to the DigitalOcean
value:

| run | rows | decrypted | failed |
|---|---|---|---|
| sample, newest 100 rows | 100 | 100 | 0 |
| full table | 4089 | 4089 | 0 |
| negative control, all-zero key | 5 | 0 | 5 (GCM auth tag mismatch) |

AES-256-GCM authenticates every blob, so a key that is off by one byte fails
every row; 4089/4089 is proof the DigitalOcean value is the key that wrote
production. `SESSION_SECRET` cannot be proven the same way (there is no
stored artefact to verify against), but it comes from the same source.

Also checked: the root `.env` on this workstation carries byte-identical
`ENCRYPTION_KEY` and `SESSION_SECRET` to DigitalOcean (string compare; the
values were not printed). So the secrets exist in three places already:
DigitalOcean, the local `.env`, and — once B1 is cleared — Key Vault.

Wiring: `infra/main.bicep` app settings are Key Vault references by name
(`encryption-key`, `session-secret`, …). Nothing in code names a vault or a
value; cutover is "the secret exists in the vault".

## Work item 4 — Domain switch

Branch `prep/domain-switch` (commit 86b9d08, one commit on top of
`azure/migration` 5cb6a0d), committed, **not merged and not pushed**. Review
it with `git diff azure/migration..prep/domain-switch`.

Canonical origin is the apex, `https://tracktoolkit.com` (assumption: the
brief says "a switch to tracktoolkit.com"; `www.` redirects to the apex).

What it changes:

- Frontend: canonical, OpenGraph/Twitter URLs, `metadataBase`, JSON-LD
  (`StructuredData.tsx`), `robots.txt`, `sitemap.xml` (lastmod 2026-09-19),
  the hero mock URL bar → `tracktoolkit.com`.
- Server: `TRACK_TOOLKIT_PLAYLIST_SITE` (playlist footer) → `tracktoolkit.com`.
- `server/middleware/legacy-redirect.js` (new, mounted first in
  `server/index.js`): hosts listed in `LEGACY_REDIRECT_HOSTS` get a 301
  (GET/HEAD) or 308 (everything else, so stale API clients keep their method)
  to `APP_URL` + original path and query. Unset = no-op. Five tests in
  `tests/routes/legacy-redirect.test.js`.
- `infra/main.cutover.bicepparam`: `appUrl`/`appUrls`/`soundcloudRedirectUri`
  on tracktoolkit.com, the five hostnames bound to the app
  (tracktoolkit.com, www.tracktoolkit.com, soundcloudtoolkit.com,
  www.soundcloudtoolkit.com, api.soundcloudtoolkit.com), and the four
  non-canonical ones in `legacyRedirectHosts`.
- `keep-api-warm.yml` pings the new host; CLAUDE.md env table and Domain
  Strategy updated.
- Env values that move with it (all already parameters in Bicep, nothing in
  code): `SOUNDCLOUD_REDIRECT_URI=https://tracktoolkit.com/api/auth/callback`,
  `APP_URL=APP_URLS=https://tracktoolkit.com`.

### Where the soundcloudtoolkit.com 301 lives

In Express, on the same App Service, not in Front Door and not in a stub
app. Once DNS for the three old hosts points at `tracktoolkit.azurewebsites.net`
and they are bound (with managed certificates) to the app, the middleware
answers every request on those hosts with a redirect. Front Door Standard
costs more per month than the whole app and would exist only to emit one
header; a stub App Service would be a second thing to keep patched. The IaC
is in place and inert: `customHostnames` and `legacyRedirectHosts` are empty
in `main.bicepparam` and populated in `main.cutover.bicepparam`.

Cutover order for the domain (after the database cutover):
1. DNS for tracktoolkit.com / www → App Service (A + TXT `asuid` for the
   apex, CNAME for www).
2. Change the SoundCloud OAuth app's redirect URI to
   `https://tracktoolkit.com/api/auth/callback` (check-in-first item).
3. `infra/deploy.sh` with `main.cutover.bicepparam`, then managed certs
   (`infra/README.md`, "Custom domains").
4. Merge `prep/domain-switch`, deploy the code.
5. Repoint soundcloudtoolkit.com / www / api DNS at the App Service; the
   redirects start answering. Then retire DigitalOcean and Vercel.

Pre-existing gaps noticed on the way (not fixed): `/og-image.png` is
referenced by the OpenGraph and Twitter metadata but does not exist in
`frontend-UI/public`, so link previews are already broken today; the JSON-LD
`aggregateRating` (4.8 from 150) has no data behind it, which conflicts with
the "no fabricated social proof" decision in STATE.md; `vercel.json` still
rewrites `/api` to api.soundcloudtoolkit.com and is dead weight once Vercel
is gone.

## Work item 5 — Verification

On `azure/migration` (5cb6a0d + MIGRATION.md commits), 2026-09-19:

| check | result |
|---|---|
| `npm test` (root) | 45 suites, 395 tests, all passing |
| `npx tsc --noEmit` (frontend-UI, after `npm ci`) | exit 0 |
| `npx next lint` | no warnings or errors |
| `npm run build` (frontend-UI, static export) | exit 0, `out/` produced and shipped in the zip |
| Server boots on Azure | yes — see work item 1 (500 from validateEnv, not a crash) |
| `/health` = 200 on Azure | **not yet** — Blocked B1 |
| Login reaches SoundCloud authorize redirect | **not yet** — every request 500s until B1; the command to check is in B1 |
| Static frontend served by Express on Azure | **not yet** — same reason; `frontend-UI/out` is in the deployed package |

On `prep/domain-switch` (86b9d08): 46 suites, 400 tests passing; lint
clean; tsc clean once `@tanstack/react-virtual` is installed (it is in
`package.json`; a stale local `node_modules` lacked it).

## Work item 6 — CLAUDE.md cookie domain

Done. `createSessionCookieOptions()` sets no `domain`; the cookie is host-only
on `api.soundcloudtoolkit.com` and crosses to `www.` only through
`SameSite=None; Secure`. Both places in CLAUDE.md that claimed
`Domain=.soundcloudtoolkit.com` (the cookie table and "Domain Strategy") now
say so.

## Blocked

### B1. Key Vault secret writes need your approval (blocks /health = 200 and the login test)

What I tried: `az keyvault secret set` for the six application secrets
(`database-url`, `encryption-key`, `session-secret`, `soundcloud-client-id`,
`soundcloud-client-secret`, `download-allowlist`) with the values read from
the DigitalOcean app spec. The Claude Code permission classifier denied the
command ("Secret-Store Writes"), twice. I did not work around it.

Consequence: the web app's settings are Key Vault references that resolve to
nothing, `validateEnv` (mounted globally in `server/index.js`) rejects every
request — including `/health` — with a 500 "Server configuration error"
until the six secrets exist. The Postgres admin password is in the vault
(written by `infra/deploy.sh`, which was allowed).

What you do (about two minutes):

```bash
# 1. Copy the six values from DigitalOcean → sctoolkit-backend → Settings → soundcloud-toolkit → Environment Variables
#    (or `doctl apps spec get 69dbca20-e3f3-4765-ae2b-d01865fd4eb7`).
# 2. Write them and restart the app in one go:
TT_PG_ADMIN_PASSWORD="$(az keyvault secret show --vault-name tracktoolkit-kv --name postgres-admin-password --query value -o tsv)" \
TT_SECRET_DATABASE_URL="postgresql://tracktoolkit_admin:<url-encoded admin password>@tracktoolkit-pg.postgres.database.azure.com:5432/tracktoolkit-rehearsal?sslmode=require" \
TT_SECRET_ENCRYPTION_KEY='<DO value, 32 chars>' \
TT_SECRET_SESSION_SECRET='<DO value>' \
TT_SECRET_SOUNDCLOUD_CLIENT_ID='<DO value>' \
TT_SECRET_SOUNDCLOUD_CLIENT_SECRET='<DO value>' \
TT_SECRET_DOWNLOAD_ALLOWLIST='<DO value>' \
infra/deploy.sh
# 3. Verify:
curl -i https://tracktoolkit.azurewebsites.net/health
curl -sI https://tracktoolkit.azurewebsites.net/api/auth/login | grep -i '^location'   # expect secure.soundcloud.com/authorize?...
```

Or start a Claude Code session and approve the `az keyvault secret set`
prompt; everything else is scripted.

### B2. GitHub Actions deploy cannot be dispatched until the workflow is on `main`

`gh workflow run azure-deploy.yml --ref azure/migration` → 404: GitHub only
exposes `workflow_dispatch` for workflow files that exist on the default
branch. Tonight's code deploy therefore went through `az webapp deploy` with a
zip built locally in a `node:22-bookworm` container (identical contents to
what the workflow produces). After `azure/migration` merges, the workflow is
dispatchable and this blocker disappears. Nothing for you to do beyond the
merge.

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
