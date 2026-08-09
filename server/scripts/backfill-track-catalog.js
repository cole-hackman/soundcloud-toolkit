// One-time backfill: enrich every distinct track ID recorded in
// operation_logs metadata (~18,613 IDs at the time of writing) into the
// tracks catalog via GET /tracks?ids=, using one named user's OAuth tokens.
//
// ── GATED OFF BY DEFAULT ────────────────────────────────────────────────────
// Bulk-fetching historical metadata may be constrained by SoundCloud's API
// terms (see TERMS-CHECK.md — caching limits and dataset/aggregation clauses).
// Do NOT run this until those questions are answered. It refuses to run
// unless BACKFILL_TRACKS_ENABLED=true is set explicitly.
//
// Usage:
//   BACKFILL_TRACKS_ENABLED=true node server/scripts/backfill-track-catalog.js --sc-user-id 472267677
//
// Idempotent: already-resolved catalog rows are skipped; safe to re-run after
// an interruption.
import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';
import { enrichTrackIds } from '../lib/enrichment.js';

const CHUNK = 500; // IDs handed to enrichTrackIds per round (10 API batches)

async function main() {
  if (process.env.BACKFILL_TRACKS_ENABLED !== 'true') {
    console.error(
      'Refusing to run: BACKFILL_TRACKS_ENABLED is not "true".\n' +
      'Read TERMS-CHECK.md first, then run with BACKFILL_TRACKS_ENABLED=true.'
    );
    process.exitCode = 1;
    return;
  }

  const flagIndex = process.argv.indexOf('--sc-user-id');
  const scUserId = flagIndex > -1 ? Number(process.argv[flagIndex + 1]) : NaN;
  if (!Number.isInteger(scUserId)) {
    console.error('Usage: --sc-user-id <soundcloudId of the account whose tokens to use>');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { soundcloudId: scUserId },
    include: { tokens: true },
  });
  if (!user || user.tokens.length === 0) {
    console.error(`No user/tokens found for soundcloudId ${scUserId}`);
    process.exitCode = 1;
    return;
  }
  const accessToken = decrypt(user.tokens[0].encrypted, process.env.ENCRYPTION_KEY);
  const refreshToken = decrypt(user.tokens[0].refresh, process.env.ENCRYPTION_KEY);

  // Every distinct track ID ever captured in operation metadata
  const idRows = await prisma.$queryRaw`
    SELECT DISTINCT (jsonb_array_elements_text(metadata->'trackIds'))::bigint AS id
    FROM operation_logs
    WHERE metadata ? 'trackIds'
  `;
  const allIds = idRows.map(r => Number(r.id));
  console.log(`Found ${allIds.length} distinct track IDs in operation_logs`);

  let totals = { candidates: 0, fetched: 0, missing: 0 };
  for (let i = 0; i < allIds.length; i += CHUNK) {
    const slice = allIds.slice(i, i + CHUNK);
    const result = await enrichTrackIds(slice, accessToken, refreshToken);
    totals.candidates += result.candidates;
    totals.fetched += result.fetched;
    totals.missing += result.missing;
    console.log(
      `[${Math.min(i + CHUNK, allIds.length)}/${allIds.length}] ` +
      `enriched ${result.fetched}, missing ${result.missing}, skipped ${slice.length - result.candidates} already-known`
    );
  }
  console.log(`Done. Candidates ${totals.candidates}, fetched ${totals.fetched}, missing ${totals.missing}.`);
}

main()
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
