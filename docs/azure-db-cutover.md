# Database cutover: Neon → Azure Postgres Flexible Server

Rehearsed end to end on 2026-09-19 against the throwaway database
`tracktoolkit-rehearsal` on `tracktoolkit-pg.postgres.database.azure.com`.
Every duration below was measured during that rehearsal, from a workstation in
Europe (CEST) talking to Neon in `us-west-2` and Azure in `westus3`; running
the same commands from a box inside `westus3` will only be faster.

The real cutover restores into the `tracktoolkit` database on the same server,
which exists and is empty. Nothing in this document touches Neon except a
read-only `pg_dump`. Neon stays intact and is the rollback.

## What you need on the operator machine

- Docker (the commands run `postgres:17` so client and server versions match;
  the Homebrew `libpq@17` `pg_dump` on the Mac hung in the connection
  handshake against Neon every time, while `psql` from the same keg worked —
  the container avoids the question entirely).
- The Neon **direct** connection string (the pooler host with `-pooler`
  removed). `pg_dump` wants a session, not pgbouncer.
- The Azure admin connection string. Password is Key Vault secret
  `postgres-admin-password`; URL-encode it in the DSN.
- Your public IP allowed through the server firewall
  (`TT_CLIENT_IP=<ip> infra/deploy.sh`, or the portal).

```bash
export NEON_DIRECT='postgresql://neondb_owner:<pw>@ep-fancy-morning-afbejaye.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require'
export AZURE_PROD='postgresql://tracktoolkit_admin:<url-encoded pw>@tracktoolkit-pg.postgres.database.azure.com:5432/tracktoolkit?sslmode=require'
# The value the APP gets (Key Vault `database-url`) carries Prisma pool settings on top:
#   ...?sslmode=require&connection_limit=10&pool_timeout=30
# Prisma's default pool is (cpus*2+1) = 3 on the one-vCPU App Service, which the
# admin dashboard's parallel queries exhaust (P2024, 2026-09-21). Server max is 50.
mkdir -p ~/cutover && cd ~/cutover
```

## Source shape (measured)

Neon: PostgreSQL 17.11, 485 MB, 16 tables, 63 indexes, 13 foreign keys, no
sequences, only the `plpgsql` extension. Row counts at 21:28 CEST:

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

## The procedure

Step 0 and step 6 are the only ones that touch user-facing state. Everything
between them runs while the app is down; that window is the "expected
downtime" line at the end.

### 0. Freeze writes (start of downtime)

App Platform cannot scale a service to zero, and the app has no maintenance
switch, so the freeze is "make Neon unreachable from DigitalOcean while it
stays reachable from the operator machine". Pick one; both are reversible in
about a minute and neither deletes anything.

**Option A — Neon IP allow list (preferred, no DigitalOcean change).**
Neon → project *SoundCloud-Toolkit* → Settings → IP Allow: allow only the
operator machine's public IP (`curl -s https://api.ipify.org`). Every
DigitalOcean connection is refused from that moment; `pg_dump` still works.
Rollback: clear the list. If the plan does not offer IP Allow, use B.

**Option B — break DigitalOcean's `DATABASE_URL`.** In the app's
environment variables, change `DATABASE_URL` to point at an unreachable
host (for example replace the hostname with `frozen.invalid`). The app keeps
serving `/health` (the health check stays green) but every database-backed
route fails, so nothing is written. Rollback: restore the original value.
Each change is a config redeploy of about two minutes.

Do NOT destroy the DigitalOcean app at this point; it is the rollback until
the new stack has soaked. Destroy it afterwards (see docs/internal/MIGRATION.md).

### 1. Row counts on the source

```bash
cat > rowcounts.sql <<'SQL'
SELECT format('SELECT %L AS table_name, count(*) AS rows FROM %I', table_name, table_name)
FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name \gexec
SQL
docker run --rm -v "$PWD:/w" postgres:17 psql "$NEON_DIRECT" -At -F' | ' -f /w/rowcounts.sql | tee neon_rowcounts.txt
```

Measured: **9 s**.

### 2. Dump Neon (read-only)

```bash
time docker run --rm -v "$PWD:/w" postgres:17 \
  pg_dump "$NEON_DIRECT" --format=custom --no-owner --no-privileges --no-comments \
  --file /w/neon.dump
```

Measured: **3 min 39 s (219 s)**, 145 MB custom-format archive (compressed).
`--no-owner --no-privileges` because the Neon role `neondb_owner` does not
exist on Azure; everything is owned by whoever restores.

### 3. Restore into Azure

```bash
time docker run --rm -v "$PWD:/w" postgres:17 \
  pg_restore --dbname "$AZURE_PROD" --no-owner --no-privileges --clean --if-exists --jobs 4 \
  /w/neon.dump 2> restore.err
grep -v 'does not exist, skipping' restore.err | head
```

Measured: **11 min 11 s (671 s)** (`--jobs 4`, B1ms, zero lines on stderr). `--clean --if-exists` makes the
step re-runnable into a non-empty target; on an empty database it only
produces "does not exist, skipping" notices, which the grep hides.

Where the time goes, from `pg_stat_activity` during the rehearsal: `tracks`
(576 k rows) copies in the first few minutes; the long tail is
`library_cache_pages`, 901 rows of large JSONB that COPY as a single stream
on one worker while the other three sit idle after building the `tracks`
indexes. The restored database is 408 MB.

### 4. Apply the out-of-band SQL

`docs/sql/2026-library-cache.sql` is not in the Prisma migration history. The
dump already carries the two tables it creates (they exist in Neon), so this
is a no-op safety net that guarantees they exist even if the dump were older
than the feature. It is re-runnable.

```bash
time docker run --rm -v "$PWD/../soundcloud-toolkit/docs/sql:/sql:ro" postgres:17 \
  psql "$AZURE_PROD" -v ON_ERROR_STOP=1 -f /sql/2026-library-cache.sql
```

Measured: **3 s**. Output is `CREATE TABLE` / `CREATE INDEX` for what
`--clean` had just dropped and `already exists, skipping` notices for the
rest — both fine.

### 4b. VACUUM ANALYZE the restored tables

`pg_restore` leaves the tables with no visibility map and no hint bits, so
the first scans are slow (each page gets written on first read) and
index-only scans are impossible. On 2026-09-21 the admin genre breakdown
took 11.8 s until this ran, 0.5 s after.

```bash
time docker run --rm postgres:17 psql "$AZURE_PROD" -c 'VACUUM (ANALYZE) "tracks", "operation_logs"; VACUUM (ANALYZE);'
```

Measured: **~25 s** for the two big tables (the full-database pass adds a
few seconds). Then apply `docs/sql/2026-catalog-admin-indexes.sql` (also
not in the Prisma schema; see its header).

### 5. Verify

```bash
docker run --rm -v "$PWD:/w" postgres:17 psql "$AZURE_PROD" -At -F' | ' -f /w/rowcounts.sql | tee azure_rowcounts.txt
diff <(sort neon_rowcounts.txt) <(sort azure_rowcounts.txt) && echo IDENTICAL
docker run --rm postgres:17 psql "$AZURE_PROD" -Atc "
  select 'tables', count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
  union all select 'indexes', count(*) from pg_indexes where schemaname='public'
  union all select 'fk_constraints', count(*) from information_schema.table_constraints where constraint_schema='public' and constraint_type='FOREIGN KEY';"
```

Expect 16 / 63 / 13 to match the source. Measured: **3 s** for the target
counts, **6 s** with the diff and structure query.

Rehearsal result: all 16 tables matched except `operation_logs`, restored
at 22092 against a source count of 22091 taken eleven minutes earlier — the
production app was still writing (a recount after the restore showed 22093).
That one-row drift is exactly what step 0 exists to prevent; with writes
frozen the diff is empty.

Then the decrypt round-trip, which proves the `ENCRYPTION_KEY` the Azure app
will use opens the token blobs that were just restored. Run from the repo
root (it needs the generated Prisma client); it prints counts only, never a
token. Rehearsal result: 4089/4089 rows with the production key, 0/5 with a
wrong key (docs/internal/MIGRATION.md, work item 3).

```bash
cat > /tmp/decrypt-roundtrip.mjs <<'JS'
import { PrismaClient } from '@prisma/client';
import { decrypt } from './server/lib/crypto.js';
const key = process.env.ENCRYPTION_KEY;
const prisma = new PrismaClient();
const rows = await prisma.token.findMany({ select: { encrypted: true, refresh: true } });
let ok = 0, bad = 0;
for (const r of rows) { try { decrypt(r.encrypted, key); decrypt(r.refresh, key); ok++; } catch { bad++; } }
console.log({ rows: rows.length, decryptedOk: ok, decryptFailed: bad });
await prisma.$disconnect(); process.exit(bad ? 1 : 0);
JS
cp /tmp/decrypt-roundtrip.mjs ./decrypt-roundtrip.mjs
DATABASE_URL="$AZURE_PROD" ENCRYPTION_KEY="$(az keyvault secret show --vault-name tracktoolkit-kv --name encryption-key --query value -o tsv)" node decrypt-roundtrip.mjs
rm decrypt-roundtrip.mjs
```

### 6. Point the app at Azure (end of downtime)

Key Vault secret `database-url` → the `AZURE_PROD` DSN, then restart:

```bash
TT_PG_ADMIN_PASSWORD="$(az keyvault secret show --vault-name tracktoolkit-kv --name postgres-admin-password --query value -o tsv)" \
TT_SECRET_DATABASE_URL="$AZURE_PROD" infra/deploy.sh
curl -fsS https://tracktoolkit.azurewebsites.net/health
```

Measured: app restart with Key Vault reference resolution is about a minute.

## Expected downtime

| step | measured |
|---|---|
| 1. source counts | 9 s |
| 2. dump | 3 min 39 s |
| 3. restore | 11 min 11 s |
| 4. library-cache SQL | 3 s |
| 5. verify (counts + diff) | ~10 s |
| 6. repoint + restart | ~1 min |
| **total** | **~16 min (measured 15 min 12 s of command time)** |

Budget **25 minutes** of downtime, announce 30 minutes. The dump and
restore scale with `tracks` (576 k rows, most of the bytes) and
`library_cache_pages` (JSONB, few rows but large); if the catalog has grown
noticeably since 2026-09-19, re-measure step 2 against a Neon branch before
the real run.

Two things shorten it if it ever matters: run the operator commands from a
VM in `westus3` (removes the transatlantic hop for the restore), and dump
before the freeze with a second incremental pass — not worth it at this
size.

## Rollback

At any point before step 6: nothing has changed for users. Undo the freeze
(clear the Neon allow list, or restore `DATABASE_URL` on DigitalOcean). Neon
was only read.

After step 6: set Key Vault `database-url` back to the Neon DSN and restart
(same command as step 6 with the Neon string), or undo the freeze on
DigitalOcean and repoint DNS. Writes that landed on Azure between step 6 and the rollback
are lost unless you reverse-dump them; that is the reason for the freeze in
step 0 and for keeping the window short.

`tracktoolkit-rehearsal` can be dropped at any time
(`az postgres flexible-server db delete -g rg-tracktoolkit -s tracktoolkit-pg -d tracktoolkit-rehearsal`);
nothing depends on it once the parallel stack is repointed.

## The real run (2026-09-20)

Executed exactly as above, freeze via Option B at 18:49 CEST (DigitalOcean
`DATABASE_URL` hostname replaced; Neon's pooled connections from the app
dropped to zero at 18:49:13, which was the go signal).

| step | measured |
|---|---|
| 1. source counts | 6 s |
| 2. `pg_dump` (149 MB) | 230 s |
| 3. `pg_restore -j 4` into `tracktoolkit` | 692 s, 0 stderr lines |
| 4. library-cache SQL | 2 s |
| 5. verify: 16 tables identical (4,105 users, 578,450 tracks), 16/63/13 | 5 s |
| 6. Key Vault `database-url` + settings nudge → healthy container | ~1 min |
| **steps 1–6** | **~17 min** |

The code deploy and the domain parameters were applied in parallel with the
restore, which shortened the window, but the parameter deploy detached the
custom hostnames' certificates for 14 minutes (fixed in `main.bicep`, see
docs/internal/MIGRATION.md). Nothing was written to Neon after the freeze; it remains the
rollback copy.
