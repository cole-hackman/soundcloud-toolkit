-- Adds the in-app feedback table (Prisma model Feedback).
--
-- Generated with `prisma migrate diff --from-empty --to-schema-datamodel
-- prisma/schema.prisma --script` against prisma/schema.prisma, then made
-- re-runnable so a second execution is a no-op rather than an error.
--
-- Purely additive: creates one table, three indexes, and one foreign key.
-- It does not touch users, tokens, rebrand_votes, beta_signups,
-- survey_responses, or any of the cross-branch tables (chat_*, indexed_*,
-- library_snapshots).
--
-- WHERE TO RUN THIS: the **Azure PostgreSQL Flexible Server** database
-- `tracktoolkit` on `tracktoolkit-pg.postgres.database.azure.com`. Not Neon.
-- Neon is the legacy database, kept only until decommission (see
-- docs/internal/MIGRATION.md); production has read and written Azure since the
-- 2026-09-20 cutover, so applying this to Neon changes nothing the app reads.
--
-- With psql, the same way docs/azure-db-cutover.md applies out-of-band SQL:
--
--   export AZURE_PROD='postgresql://tracktoolkit_admin:<url-encoded pw>@tracktoolkit-pg.postgres.database.azure.com:5432/tracktoolkit?sslmode=require'
--   docker run --rm -v "$PWD/docs/sql:/sql:ro" postgres:17 \
--     psql "$AZURE_PROD" -v ON_ERROR_STOP=1 -f /sql/2026-09-feedback.sql
--
-- (password: Key Vault `tracktoolkit-kv`, secret `postgres-admin-password`.)
--
-- RUN IT BEFORE THE BRANCH MERGES. `main` deploys to App Service on every
-- push, so the merge itself ships the code; the first `POST /api/feedback`,
-- `GET /api/feedback/mine` or admin inbox read before this has run is a 500.

CREATE TABLE IF NOT EXISTS "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "soundcloudId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "email" TEXT,
    "clientInfo" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    "messageHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- No DEFAULT on purpose: `updatedAt` is `@updatedAt`, so Prisma writes it
    -- on every create and update. Matching prisma migrate diff exactly here
    -- keeps a later diff against the live database from reporting drift.
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- The admin inbox reads by status, newest first.
CREATE INDEX IF NOT EXISTS "feedback_status_createdAt_idx"
    ON "feedback"("status", "createdAt");

-- GET /api/feedback/mine — the user's own last 20, newest first.
CREATE INDEX IF NOT EXISTS "feedback_userId_createdAt_idx"
    ON "feedback"("userId", "createdAt");

-- The 24-hour duplicate check on POST /api/feedback. Deliberately NOT unique:
-- the same person may legitimately re-report the same thing weeks later, so
-- the window is enforced in the query, not by a constraint.
CREATE INDEX IF NOT EXISTS "feedback_userId_messageHash_createdAt_idx"
    ON "feedback"("userId", "messageHash", "createdAt");

-- Cascade so deleting an account removes its feedback, matching every other
-- per-user table (guarded by tests/account-deletion-cascade.test.js).
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, hence the guard block.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedback_userId_fkey'
    ) THEN
        ALTER TABLE "feedback"
            ADD CONSTRAINT "feedback_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
