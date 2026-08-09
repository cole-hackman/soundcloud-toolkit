-- Music catalog: one row per SoundCloud track/playlist ever touched by an
-- operation. Public metadata only; not keyed to any user.

CREATE TABLE "tracks" (
    "id" BIGINT NOT NULL,
    "title" TEXT,
    "artistName" TEXT,
    "artistId" BIGINT,
    "genre" TEXT,
    "genreNormalized" TEXT,
    "durationMs" INTEGER,
    "access" TEXT,
    "permalinkUrl" TEXT,
    "resolveStatus" TEXT NOT NULL DEFAULT 'pending',
    "resolveAttempts" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playlists" (
    "id" BIGINT NOT NULL,
    "title" TEXT,
    "ownerScId" BIGINT,
    "trackCount" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tracks_genreNormalized_idx" ON "tracks"("genreNormalized");
CREATE INDEX "tracks_artistName_idx" ON "tracks"("artistName");
CREATE INDEX "tracks_resolveStatus_idx" ON "tracks"("resolveStatus");
CREATE INDEX "tracks_access_idx" ON "tracks"("access");
CREATE INDEX "tracks_lastSeenAt_idx" ON "tracks"("lastSeenAt");

-- GIN index so admin catalog queries can unnest metadata->'trackIds' without scans
CREATE INDEX "operation_logs_metadata_idx" ON "operation_logs" USING GIN ("metadata");
