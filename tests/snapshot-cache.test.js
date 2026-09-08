import { jest } from '@jest/globals';

const state = { rows: new Map(), pages: new Map() };
const key = (userId, resource) => `${userId}::${resource}`;

// A small in-memory stand-in for the two Prisma models, enough to exercise the
// read-through, staleness and transaction semantics without a database.
const libraryCacheState = {
  findUnique: jest.fn(async ({ where }) =>
    state.rows.get(key(where.userId_resource.userId, where.userId_resource.resource)) ?? null),
  upsert: jest.fn(async ({ where, create, update }) => {
    const k = key(where.userId_resource.userId, where.userId_resource.resource);
    const existing = state.rows.get(k);
    const row = existing ? { ...existing, ...update } : { ...create };
    state.rows.set(k, row);
    return row;
  }),
  updateMany: jest.fn(async ({ where, data }) => {
    let count = 0;
    for (const [k, row] of state.rows) {
      if (row.userId === where.userId && where.resource.in.includes(row.resource)) {
        state.rows.set(k, { ...row, ...data });
        count += 1;
      }
    }
    return { count };
  }),
  deleteMany: jest.fn(async ({ where }) => {
    for (const [k, row] of state.rows) if (row.userId === where.userId) state.rows.delete(k);
    return { count: 0 };
  }),
};

const libraryCachePage = {
  findMany: jest.fn(async ({ where }) =>
    (state.pages.get(key(where.userId, where.resource)) ?? [])
      .slice().sort((a, b) => a.pageIndex - b.pageIndex)),
  findUnique: jest.fn(async ({ where }) => {
    const w = where.userId_resource_pageIndex;
    return (state.pages.get(key(w.userId, w.resource)) ?? [])
      .find((p) => p.pageIndex === w.pageIndex) ?? null;
  }),
  create: jest.fn(async ({ data }) => {
    const k = key(data.userId, data.resource);
    state.pages.set(k, [...(state.pages.get(k) ?? []), data]);
    return data;
  }),
  upsert: jest.fn(async ({ where, create, update }) => {
    const w = where.userId_resource_pageIndex;
    const k = key(w.userId, w.resource);
    const list = state.pages.get(k) ?? [];
    const idx = list.findIndex((p) => p.pageIndex === w.pageIndex);
    if (idx >= 0) list[idx] = { ...list[idx], ...update };
    else list.push({ ...create });
    state.pages.set(k, list);
    return list[idx >= 0 ? idx : list.length - 1];
  }),
  deleteMany: jest.fn(async ({ where }) => {
    if (where.resource) state.pages.delete(key(where.userId, where.resource));
    else for (const k of state.pages.keys()) if (k.startsWith(`${where.userId}::`)) state.pages.delete(k);
    return { count: 0 };
  }),
};

jest.unstable_mockModule('../server/lib/prisma.js', () => ({
  default: {
    libraryCacheState,
    libraryCachePage,
    // $transaction here just awaits the promises it is handed, which is what
    // the real client does for an array of operations.
    $transaction: async (ops) => Promise.all(ops),
  },
}));

const snapshot = await import('../server/lib/snapshot-cache.js');

beforeEach(() => {
  state.rows.clear();
  state.pages.clear();
});

describe('writeSnapshot / readSnapshot', () => {
  test('a collection round-trips through page rows', async () => {
    const items = Array.from({ length: 450 }, (_, i) => ({ id: i }));
    const written = await snapshot.writeSnapshot('u1', 'likes', items);

    // 450 items at a 200-item page size is three rows, not one giant blob.
    expect(written).toEqual({ pages: 3, items: 450 });

    const read = await snapshot.readSnapshot('u1', 'likes');
    expect(read.items).toHaveLength(450);
    expect(read.items[0]).toEqual({ id: 0 });
    expect(read.items[449]).toEqual({ id: 449 });
    expect(read.complete).toBe(true);
    expect(read.stale).toBe(false);
  });

  test('a shrinking collection does not leave orphaned tail pages', async () => {
    await snapshot.writeSnapshot('u1', 'likes', Array.from({ length: 600 }, (_, i) => ({ id: i })));
    await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }, { id: 2 }]);

    const read = await snapshot.readSnapshot('u1', 'likes');
    expect(read.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('a snapshot older than its TTL reads back as stale but still complete', async () => {
    await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }]);
    const row = state.rows.get('u1::likes');
    row.syncedAt = new Date(Date.now() - 60 * 60 * 1000); // an hour ago

    const read = await snapshot.readSnapshot('u1', 'likes');
    expect(read.stale).toBe(true);
    expect(read.complete).toBe(true);
    expect(read.items).toEqual([{ id: 1 }]); // still served
  });

  test('a snapshot that never completed is NOT served', async () => {
    // A half-written crawl must not be passed off as the whole library.
    await snapshot.markSyncState('u1', 'likes', { status: 'syncing', pagesSynced: 2 });
    await snapshot.writeSnapshotPage('u1', 'likes', 0, [{ id: 1 }]);

    expect(await snapshot.readSnapshot('u1', 'likes')).toBeNull();
  });

  test('truncation survives the round trip', async () => {
    await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }], { truncated: true });
    const read = await snapshot.readSnapshot('u1', 'likes');
    expect(read.truncated).toBe(true);
  });

  test('invalidate marks stale without destroying the snapshot', async () => {
    await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }]);
    await snapshot.invalidateSnapshot('u1', ['likes']);

    // status is no longer 'complete', so readSnapshot declines to serve it and
    // the caller re-crawls rather than showing pre-mutation data.
    expect(await snapshot.readSnapshot('u1', 'likes')).toBeNull();
    expect(state.pages.get('u1::likes')).toBeDefined(); // rows kept
  });

  test('unknown resources are rejected rather than silently cached', async () => {
    await expect(snapshot.readSnapshot('u1', 'bananas')).rejects.toThrow(/Unknown snapshot resource/);
  });

  test('a database failure fails soft so the request can still crawl', async () => {
    libraryCacheState.findUnique.mockRejectedValueOnce(new Error('connection reset'));
    await expect(snapshot.readSnapshot('u1', 'likes')).resolves.toBeNull();
  });
});

describe('page-level access', () => {
  test('an individual page can be written and read back', async () => {
    await snapshot.writeSnapshotPage('u1', 'likes', 3, [{ id: 'a' }, { id: 'b' }]);
    const page = await snapshot.readSnapshotPage('u1', 'likes', 3);
    expect(page).toEqual({ items: [{ id: 'a' }, { id: 'b' }], itemCount: 2 });
  });

  test('a missing page reads as null', async () => {
    expect(await snapshot.readSnapshotPage('u1', 'likes', 9)).toBeNull();
  });
});
