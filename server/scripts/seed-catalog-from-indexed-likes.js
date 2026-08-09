// One-time, idempotent seed of the tracks catalog from the indexed_likes
// table (written by the unmerged feature/ai-library-chat branch — 1,021 rows
// in production, already carrying title/artist/genre/access).
//
// Usage: node server/scripts/seed-catalog-from-indexed-likes.js
// Safe to re-run: upserts never blank out existing catalog data.
import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { upsertTrackRows, normalizeGenre } from '../lib/catalog.js';

async function main() {
  const rows = await prisma.indexed_likes.findMany();
  console.log(`Read ${rows.length} indexed_likes rows`);

  const trackRows = rows.map(r => ({
    id: Number(r.trackId),
    title: r.title ?? null,
    artistName: r.artistName ?? null,
    artistId: r.artistId != null ? Number(r.artistId) : null,
    genre: r.genre ?? null,
    genreNormalized: r.genreNormalized ?? normalizeGenre(r.genre),
    durationMs: r.durationMs ?? null,
    access: r.access ?? null,
    permalinkUrl: null,
  })).filter(r => Number.isInteger(r.id) && r.id > 0);

  const upserted = await upsertTrackRows(trackRows);
  console.log(`Upserted ${upserted} distinct tracks into the catalog`);
}

main()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
