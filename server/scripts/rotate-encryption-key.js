// Re-encrypt every tokens row from one ENCRYPTION_KEY to another.
//
// Both keys and the database come from the ENVIRONMENT, never from argv
// (argv is visible in `ps`). This script deliberately does NOT load .env:
// pointing it at a database has to be an explicit act.
//
//   DATABASE_URL=postgresql://... \
//   OLD_ENCRYPTION_KEY=<32 chars> NEW_ENCRYPTION_KEY=<32 chars> \
//   node server/scripts/rotate-encryption-key.js [--dry-run] [--batch-size 200]
//
// Idempotent and resumable: a row whose blobs already open with the NEW key is
// skipped, a row that opens with the OLD key is re-encrypted, and a row that
// opens with neither is left untouched and counted, so an interrupted run can
// simply be started again. Each batch is written in one transaction, and every
// update is guarded on the ciphertext it read, so a token refresh that lands
// mid-run is never overwritten (that row is reported and picked up next run).
//
// Cutover order: run this, THEN switch the app's ENCRYPTION_KEY, in that
// window no request can decrypt (tokens are read on every authenticated
// request), so run it while the app is stopped or immediately before the
// key flips. Nothing here prints a key or a token.
import { pathToFileURL } from 'url';
import { encrypt, decrypt } from '../lib/crypto.js';

export const KEY_LENGTH = 32;

/**
 * Pure decision for one row. Returns:
 *   { action: 'skip' }                       already encrypted with newKey
 *   { action: 'rotate', encrypted, refresh } re-encrypted blobs to write
 *   { action: 'undecryptable' }              opens with neither key
 * Never throws for a bad blob; throws only for a malformed key.
 */
export function rotateTokenRow(row, oldKey, newKey) {
  assertKey(oldKey, 'OLD_ENCRYPTION_KEY');
  assertKey(newKey, 'NEW_ENCRYPTION_KEY');
  const withNew = tryDecryptPair(row, newKey);
  if (withNew) return { action: 'skip' };
  const withOld = tryDecryptPair(row, oldKey);
  if (!withOld) return { action: 'undecryptable' };
  return {
    action: 'rotate',
    encrypted: encrypt(withOld.access, newKey),
    refresh: encrypt(withOld.refresh, newKey),
  };
}

function assertKey(key, name) {
  if (typeof key !== 'string' || key.length !== KEY_LENGTH) {
    throw new Error(`${name} must be exactly ${KEY_LENGTH} characters`);
  }
}

function tryDecryptPair(row, key) {
  try {
    return { access: decrypt(row.encrypted, key), refresh: decrypt(row.refresh, key) };
  } catch {
    return null;
  }
}

export function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const i = argv.indexOf('--batch-size');
  const batchSize = i > -1 ? Number(argv[i + 1]) : 200;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('--batch-size must be a positive integer');
  }
  return { dryRun, batchSize };
}

/**
 * Walk the table in id order and apply rotateTokenRow to every row.
 * `prisma` is injected so the loop is testable without a database.
 */
export async function rotateAll(prisma, { oldKey, newKey, dryRun, batchSize, log = () => {} }) {
  const counts = { scanned: 0, skipped: 0, rotated: 0, undecryptable: 0, changedUnderneath: 0 };
  let cursor = null;
  for (;;) {
    const rows = await prisma.token.findMany({
      take: batchSize,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, encrypted: true, refresh: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    const writes = [];
    for (const row of rows) {
      counts.scanned += 1;
      const result = rotateTokenRow(row, oldKey, newKey);
      if (result.action === 'skip') counts.skipped += 1;
      else if (result.action === 'undecryptable') counts.undecryptable += 1;
      else writes.push({ row, result });
    }

    if (dryRun) {
      counts.rotated += writes.length;
    } else if (writes.length > 0) {
      // Guard each update on the ciphertext we read: a refresh that landed
      // between read and write leaves count 0 and the row is reported.
      const results = await prisma.$transaction(
        writes.map(({ row, result }) =>
          prisma.token.updateMany({
            where: { id: row.id, encrypted: row.encrypted, refresh: row.refresh },
            data: { encrypted: result.encrypted, refresh: result.refresh },
          })
        )
      );
      for (const r of results) {
        if (r.count === 1) counts.rotated += 1;
        else counts.changedUnderneath += 1;
      }
    }
    log(`batch done: scanned=${counts.scanned} rotated=${counts.rotated} skipped=${counts.skipped}`);
  }
  return counts;
}

async function main() {
  const { dryRun, batchSize } = parseArgs(process.argv.slice(2));
  const { DATABASE_URL, OLD_ENCRYPTION_KEY, NEW_ENCRYPTION_KEY } = process.env;
  if (!DATABASE_URL) throw new Error('DATABASE_URL must be set explicitly (this script does not read .env)');
  assertKey(OLD_ENCRYPTION_KEY, 'OLD_ENCRYPTION_KEY');
  assertKey(NEW_ENCRYPTION_KEY, 'NEW_ENCRYPTION_KEY');
  if (OLD_ENCRYPTION_KEY === NEW_ENCRYPTION_KEY) throw new Error('OLD and NEW keys are identical; nothing to do');

  let host = '(unparseable)';
  try { host = new URL(DATABASE_URL).host; } catch {}
  console.log(`${dryRun ? 'DRY RUN' : 'ROTATING'} tokens on ${host} (batch ${batchSize})`);

  const { default: prisma } = await import('../lib/prisma.js');
  try {
    const counts = await rotateAll(prisma, {
      oldKey: OLD_ENCRYPTION_KEY,
      newKey: NEW_ENCRYPTION_KEY,
      dryRun,
      batchSize,
      log: (m) => console.log(m),
    });
    console.log(JSON.stringify({ dryRun, ...counts }));
    if (counts.undecryptable > 0 || counts.changedUnderneath > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
