-- Account lifecycle: login/disconnect stamps on users, plus the metrics table
-- that carries the lifetime distinct-user count across operation-log purges.
--
-- Mirrors the Prisma models `User.lastLoginAt` / `User.disconnectedAt` and the
-- new `Metric` model in prisma/schema.prisma. Purely additive: two nullable
-- columns, two indexes, one new table. Nothing is dropped, renamed, or
-- rewritten, so it is safe to run against a live database and safe to run
-- twice (every statement is IF NOT EXISTS).
--
-- COLUMN NAMING: this schema has no field-level `@map`, so Prisma addresses
-- columns by their camelCase model field names, quoted. `last_login_at` would
-- compile but Prisma's generated SQL would never find it. Likewise the type is
-- TIMESTAMP(3), which is what Prisma emits for `DateTime` — timestamptz would
-- register as schema drift on the next `prisma migrate diff`.
--
-- Run this in the Neon SQL Editor, then deploy the backend. Not applied by
-- this branch.

-- ── users: lifecycle stamps ────────────────────────────────────────────────

-- Stamped on every OAuth callback (create and update alike). Rows that predate
-- this column stay NULL until their owner next logs in; the retention job
-- falls back to "updatedAt" for those rather than treating NULL as ancient.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- Set when the user disconnects, or when SoundCloud reports the authorization
-- revoked. Cleared back to NULL on the next successful login.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disconnectedAt" TIMESTAMP(3);

-- Both indexes exist for the retention job's range scans, which would
-- otherwise be sequential scans over every user on every daily run.
CREATE INDEX IF NOT EXISTS "users_lastLoginAt_idx" ON "users"("lastLoginAt");
CREATE INDEX IF NOT EXISTS "users_disconnectedAt_idx" ON "users"("disconnectedAt");

-- ── metrics: counters that outlive their source rows ───────────────────────

-- One row per counter, keyed by name. `lifetime_distinct_users` is snapshotted
-- before each operation-log purge so the all-time figure is not silently
-- rewritten downward when rows age out of the 12-month window.
--
-- BIGINT because the column is a monotonic counter, not a page-sized count.
-- Deliberately NOT per-user: nothing here relates to "users", so it is absent
-- from the account-deletion cascade by design.
CREATE TABLE IF NOT EXISTS "metrics" (
    "key" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("key")
);
