-- Widen SoundCloud-ID columns from INTEGER to BIGINT.
-- SoundCloud track IDs already exceed int32 (4,079 of 18,613 IDs captured in
-- operation_logs metadata are above 2,147,483,647). growth_actions.targetId
-- stores track IDs for 'like' rows, so it can overflow today; the two survey
-- soundcloudId snapshots are widened while we're here. Type widening is
-- in-place and loss-free.
ALTER TABLE "growth_actions" ALTER COLUMN "targetId" TYPE BIGINT;
ALTER TABLE "survey_responses" ALTER COLUMN "soundcloudId" TYPE BIGINT;
ALTER TABLE "beta_signups" ALTER COLUMN "soundcloudId" TYPE BIGINT;
