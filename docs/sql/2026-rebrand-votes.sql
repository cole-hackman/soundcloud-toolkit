-- Adds the rebrand name-vote table (Prisma model RebrandVote).
--
-- Generated with `prisma migrate diff` against prisma/schema.prisma on the
-- claude/rebrand-survey-names-3ue8dk branch, then made re-runnable so a second
-- execution is a no-op rather than an error.
--
-- Purely additive: creates one table, four indexes, and one foreign key.
-- It does not touch users, tokens, beta_signups, survey_responses, or any of
-- the cross-branch tables (chat_*, indexed_*, library_snapshots).
--
-- Run this in the Neon SQL Editor, then deploy the backend.

CREATE TABLE IF NOT EXISTS "rebrand_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "soundcloudId" BIGINT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "nameChoice" TEXT NOT NULL,
    "nameIdea" TEXT,
    "featureIdea" TEXT,
    "context" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rebrand_votes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rebrand_votes_campaignId_createdAt_idx"
    ON "rebrand_votes"("campaignId", "createdAt");

CREATE INDEX IF NOT EXISTS "rebrand_votes_nameChoice_idx"
    ON "rebrand_votes"("nameChoice");

CREATE INDEX IF NOT EXISTS "rebrand_votes_soundcloudId_idx"
    ON "rebrand_votes"("soundcloudId");

-- One vote per user per campaign. This is what makes a duplicate submit
-- return 409 instead of writing a second row.
CREATE UNIQUE INDEX IF NOT EXISTS "rebrand_votes_userId_campaignId_key"
    ON "rebrand_votes"("userId", "campaignId");

-- Cascade so deleting an account removes its vote, matching every other
-- per-user table (guarded by tests/account-deletion-cascade.test.js).
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, hence the guard block.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rebrand_votes_userId_fkey'
    ) THEN
        ALTER TABLE "rebrand_votes"
            ADD CONSTRAINT "rebrand_votes_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
