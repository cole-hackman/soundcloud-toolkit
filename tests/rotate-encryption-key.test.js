import { encrypt, decrypt } from '../server/lib/crypto.js';
import { rotateTokenRow, rotateAll, parseArgs } from '../server/scripts/rotate-encryption-key.js';

const OLD = 'old-key-old-key-old-key-old-key-'; // 32
const NEW = 'new-key-new-key-new-key-new-key-'; // 32

function rowWith(key, access = 'access-token', refresh = 'refresh-token') {
  return { encrypted: encrypt(access, key), refresh: encrypt(refresh, key) };
}

describe('rotateTokenRow (pure)', () => {
  test('re-encrypts a row that opens with the old key', () => {
    const r = rotateTokenRow(rowWith(OLD, 'a1', 'r1'), OLD, NEW);
    expect(r.action).toBe('rotate');
    expect(decrypt(r.encrypted, NEW)).toBe('a1');
    expect(decrypt(r.refresh, NEW)).toBe('r1');
    expect(() => decrypt(r.encrypted, OLD)).toThrow();
  });

  test('skips a row already encrypted with the new key (idempotent)', () => {
    expect(rotateTokenRow(rowWith(NEW), OLD, NEW)).toEqual({ action: 'skip' });
  });

  test('leaves a row that opens with neither key untouched', () => {
    const other = 'xxx-key-xxx-key-xxx-key-xxx-key-';
    expect(rotateTokenRow(rowWith(other), OLD, NEW)).toEqual({ action: 'undecryptable' });
  });

  test('rejects a malformed key rather than half-rotating', () => {
    expect(() => rotateTokenRow(rowWith(OLD), 'short', NEW)).toThrow(/OLD_ENCRYPTION_KEY/);
  });
});

describe('rotateAll', () => {
  function fakePrisma(rows) {
    const updates = [];
    const client = {
      token: {
        findMany: async ({ take, cursor }) => {
          const start = cursor ? rows.findIndex((r) => r.id === cursor.id) + 1 : 0;
          return rows.slice(start, start + take).map((r) => ({ ...r }));
        },
        updateMany: (args) => ({ args }),
      },
      $transaction: async (ops) =>
        ops.map(({ args }) => {
          const row = rows.find((r) => r.id === args.where.id);
          if (row.encrypted !== args.where.encrypted) return { count: 0 };
          Object.assign(row, args.data);
          updates.push(row.id);
          return { count: 1 };
        }),
    };
    return { client, updates };
  }

  test('dry run counts without writing; a real run writes and a re-run skips everything', async () => {
    const rows = [
      { id: 'a', ...rowWith(OLD) },
      { id: 'b', ...rowWith(OLD) },
      { id: 'c', ...rowWith(NEW) },
    ];
    const { client, updates } = fakePrisma(rows);
    const opts = { oldKey: OLD, newKey: NEW, batchSize: 2 };

    const dry = await rotateAll(client, { ...opts, dryRun: true });
    expect(dry).toMatchObject({ scanned: 3, rotated: 2, skipped: 1, undecryptable: 0 });
    expect(updates).toEqual([]);

    const real = await rotateAll(client, { ...opts, dryRun: false });
    expect(real).toMatchObject({ scanned: 3, rotated: 2, skipped: 1, changedUnderneath: 0 });
    expect(updates).toEqual(['a', 'b']);
    for (const r of rows) expect(decrypt(r.encrypted, NEW)).toBe('access-token');

    const again = await rotateAll(client, { ...opts, dryRun: false });
    expect(again).toMatchObject({ scanned: 3, rotated: 0, skipped: 3 });
  });

  test('a row refreshed between read and write is not overwritten', async () => {
    const rows = [{ id: 'a', ...rowWith(OLD) }];
    const { client } = fakePrisma(rows);
    const original = client.token.findMany;
    client.token.findMany = async (args) => {
      const out = await original(args);
      rows[0].encrypted = encrypt('rotated-elsewhere', OLD); // lands after our read
      return out;
    };
    const counts = await rotateAll(client, { oldKey: OLD, newKey: NEW, dryRun: false, batchSize: 10 });
    expect(counts).toMatchObject({ rotated: 0, changedUnderneath: 1 });
    expect(decrypt(rows[0].encrypted, OLD)).toBe('rotated-elsewhere');
  });
});

describe('parseArgs', () => {
  test('defaults and flags', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, batchSize: 200 });
    expect(parseArgs(['--dry-run', '--batch-size', '50'])).toEqual({ dryRun: true, batchSize: 50 });
    expect(() => parseArgs(['--batch-size', '0'])).toThrow();
  });
});
