-- Adds the persistent library snapshot cache (Prisma models LibraryCachePage
-- and LibraryCacheState).
--
-- Generated with `prisma migrate diff` against prisma/schema.prisma on the
-- claude/web-tool-performance-audit-i9z0n8 branch, then made re-runnable so a
-- second execution is a no-op rather than an error.
--
-- Purely additive: creates two tables, three indexes, and two foreign keys.
-- It does not touch users, tokens, operation_logs, rebrand_votes, or any of
-- the cross-branch tables (chat_*, indexed_*, library_snapshots). In
-- particular this is NOT the same thing as `library_snapshots`, which belongs
-- to the AI-library-chat branch and stores a different (projected) shape.
--
-- Run this in the Neon SQL Editor, then deploy the backend. The backend
-- tolerates the tables being absent (snapshot reads and writes fail soft), so
-- the ordering is not load-bearing — but running it first avoids a window of
-- degraded caching.

CREATE TABLE IF NOT EXISTS "library_cache_pages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_cache_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "library_cache_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'stale',
    "totalItems" INTEGER,
    "pagesSynced" INTEGER NOT NULL DEFAULT 0,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_cache_states_pkey" PRIMARY KEY ("id")
);

-- One row per page of one collection. The unique constraint is what makes the
-- crawl's incremental page writes idempotent (upsert by page index).
CREATE UNIQUE INDEX IF NOT EXISTS "library_cache_pages_userId_resource_pageIndex_key"
    ON "library_cache_pages"("userId", "resource", "pageIndex");

-- Reading a whole snapshot is "all pages for (user, resource), in page order".
CREATE INDEX IF NOT EXISTS "library_cache_pages_userId_resource_idx"
    ON "library_cache_pages"("userId", "resource");

-- One state row per collection per user.
CREATE UNIQUE INDEX IF NOT EXISTS "library_cache_states_userId_resource_key"
    ON "library_cache_states"("userId", "resource");

CREATE INDEX IF NOT EXISTS "library_cache_states_userId_idx"
    ON "library_cache_states"("userId");

-- Cascade matters: deleting an account must take its cached library with it.
-- tests/account-deletion-cascade.test.js asserts this.
DO $$
BEGIN
    ALTER TABLE "library_cache_pages"
        ADD CONSTRAINT "library_cache_pages_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "library_cache_states"
        ADD CONSTRAINT "library_cache_states_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
