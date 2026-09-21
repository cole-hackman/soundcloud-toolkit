-- Indexes for the admin catalog queries (routes/admin.js: /catalog/summary,
-- /catalog/tracks). Applied to the Azure production database on 2026-09-21
-- after the migration, where these endpoints were the slowest on the page.
--
-- Neither index can be expressed in prisma/schema.prisma (Prisma 5 has no
-- expression or partial indexes), so `prisma db push` from ANY branch will
-- DROP them; re-run this file afterwards. Additive and re-runnable.
--
-- Run with psql in autocommit mode (each statement on its own):
--   psql "$DATABASE_URL" -f docs/sql/2026-catalog-admin-indexes.sql
-- CONCURRENTLY keeps the tables writable while the index builds.
--
-- Also worth knowing: after a pg_restore the tables have no visibility map
-- and no hint bits, so the first scans are slow and index-only scans are
-- impossible. `VACUUM (ANALYZE) "tracks", "operation_logs"` fixed the genre
-- breakdown from 11.8 s to 0.5 s on its own; run it after any restore
-- (docs/azure-db-cutover.md).

-- COUNT(DISTINCT COALESCE("artistId"::text, "artistName")) over 610k rows was
-- a seq scan plus a 24 MB external sort. An expression index on that exact
-- key lets it stream in order.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tracks_artist_key_idx"
    ON "tracks" ((COALESCE("artistId"::text, "artistName")));

-- The "touches" CTE reads operation_logs by createdAt and then discards ~80%
-- of rows with `metadata ? 'trackIds'`. A partial index covers only the rows
-- that have trackIds, ordered by createdAt, so the period scan reads nothing
-- it throws away.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "operation_logs_trackIds_createdAt_idx"
    ON "operation_logs" ("createdAt")
    WHERE metadata ? 'trackIds';
