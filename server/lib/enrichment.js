import prisma from './prisma.js';
import logger from './logger.js';
import { soundcloudClient } from './soundcloud-client.js';
import { upsertTrackRows, mapTrackForCatalog } from './catalog.js';
import { sleep, SC_WRITE_PACING_MS } from './pacing.js';

// Piggyback enrichment: resolve bare track IDs to catalog metadata using the
// requesting user's own token context, fire-and-forget, with the app's
// standard pacing. There is no offline token store — enrichment rides along
// on real requests (plus the manual, flag-gated backfill script).

const BATCH_SIZE = 50; // GET /tracks?ids= comma-list size
const MAX_BATCHES_PER_REQUEST = 4; // bound the work piggybacked on one request
const MAX_RESOLVE_ATTEMPTS = 3;

// IDs being enriched anywhere in this process, so concurrent requests don't
// duplicate SoundCloud calls. Single-instance assumption, like the caches.
const inFlight = new Set();

/**
 * Awaitable enrichment core. Filters to IDs that actually need work
 * (unknown to the catalog, or still 'pending' under the attempt limit),
 * fetches them in batches of 50, and updates resolve state:
 * - fetched → upserted as 'resolved'
 * - absent + previously resolved → access 'gone' (kept with last-known metadata)
 * - absent + never resolved → resolveAttempts+1, 'not_found' at 3 strikes
 * Returns { candidates, fetched, missing }.
 */
export async function enrichTrackIds(trackIds, accessToken, refreshToken, { maxBatches = Infinity } = {}) {
  const unique = [...new Set((trackIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0))]
    .filter(id => !inFlight.has(id));
  if (unique.length === 0) return { candidates: 0, fetched: 0, missing: 0 };

  const known = await prisma.track.findMany({
    where: { id: { in: unique } },
    select: { id: true, resolveStatus: true, resolveAttempts: true },
  });
  const knownById = new Map(known.map(t => [Number(t.id), t]));
  const candidates = unique.filter(id => {
    const row = knownById.get(id);
    if (!row) return true;
    return row.resolveStatus === 'pending' && row.resolveAttempts < MAX_RESOLVE_ATTEMPTS;
  }).slice(0, maxBatches === Infinity ? undefined : maxBatches * BATCH_SIZE);
  if (candidates.length === 0) return { candidates: 0, fetched: 0, missing: 0 };

  // Stub rows for brand-new IDs so attempt tracking has somewhere to live
  await prisma.track.createMany({
    data: candidates.filter(id => !knownById.has(id)).map(id => ({ id })),
    skipDuplicates: true,
  });

  candidates.forEach(id => inFlight.add(id));
  let fetched = 0;
  let missing = 0;
  try {
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      if (i > 0) await sleep(SC_WRITE_PACING_MS);

      const tracks = await soundcloudClient.getTracksByIds(accessToken, refreshToken, batch);
      const rows = tracks.map(mapTrackForCatalog).filter(Boolean);
      if (rows.length > 0) await upsertTrackRows(rows);
      fetched += rows.length;

      const returned = new Set(rows.map(r => r.id));
      const absent = batch.filter(id => !returned.has(id));
      missing += absent.length;
      if (absent.length > 0) {
        // Previously-resolved rows that vanished upstream: keep the metadata,
        // mark them gone. (TERMS-CHECK.md clause 2 decides if this must
        // become a hard delete.)
        await prisma.track.updateMany({
          where: { id: { in: absent }, title: { not: null } },
          data: { access: 'gone', resolveStatus: 'gone' },
        });
        // Never-resolved rows: count the strike, three strikes → not_found
        await prisma.$executeRaw`
          UPDATE "tracks"
          SET "resolveAttempts" = "resolveAttempts" + 1,
              "resolveStatus" = CASE
                WHEN "resolveAttempts" + 1 >= ${MAX_RESOLVE_ATTEMPTS} THEN 'not_found'
                ELSE "resolveStatus"
              END
          WHERE "id" = ANY(${absent}) AND "resolveStatus" = 'pending'
        `;
      }
    }
  } finally {
    candidates.forEach(id => inFlight.delete(id));
  }
  return { candidates: candidates.length, fetched, missing };
}

/**
 * Fire-and-forget wrapper for request handlers. Call WITHOUT await, after the
 * response is sent — never throws, bounded to 4 batches (200 IDs) per request.
 */
export function piggybackEnrichment(trackIds, accessToken, refreshToken) {
  if (!Array.isArray(trackIds) || trackIds.length === 0) return;
  enrichTrackIds(trackIds, accessToken, refreshToken, { maxBatches: MAX_BATCHES_PER_REQUEST })
    .catch(err => logger.error('[enrichment] Piggyback enrichment failed:', err.message));
}
