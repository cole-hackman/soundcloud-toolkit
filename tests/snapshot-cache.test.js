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
      if (row.userId !== where.userId || !where.resource.in.includes(row.resource)) continue;
      // Honour the one comparison invalidateSnapshot uses, so the
      // conditional-compensation tests exercise real filtering.
      if (where.syncedAt?.lte instanceof Date
        && !(row.syncedAt instanceof Date && row.syncedAt.getTime() <= where.syncedAt.lte.getTime())) continue;
      state.rows.set(k, { ...row, ...data });
      count += 1;
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
    expect(written).toMatchObject({ pages: 3, items: 450 });
    // The stamp is produced here, in Node, once — and handed back so a caller
    // can condition a later compensating invalidation on it.
    expect(written.syncedAt).toBeInstanceOf(Date);
    const row = state.rows.get('u1::likes');
    expect(row.syncedAt).toBe(written.syncedAt);

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

  test('a page set short of what the state row counted is NOT served', async () => {
    // The retention sweep ages page rows by `createdAt` and the state row by
    // `updatedAt` — different columns, so the pages can be purged while a
    // 'complete' state row survives. Serving what is left would silently hand
    // back a library with a hole in it; a null costs one crawl.
    const quiet = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await snapshot.writeSnapshot('u1', 'likes', Array.from({ length: 450 }, (_, i) => ({ id: i })));
      expect(state.rows.get('u1::likes').pagesSynced).toBe(3);

      // One page disappears; the state row still says 'complete' with three.
      const pages = state.pages.get('u1::likes');
      state.pages.set('u1::likes', pages.filter((p) => p.pageIndex !== 1));

      expect(await snapshot.readSnapshot('u1', 'likes')).toBeNull();
    } finally {
      quiet.mockRestore();
    }
  });

  test('truncation survives the round trip', async () => {
    await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }], { truncated: true });
    const read = await snapshot.readSnapshot('u1', 'likes');
    expect(read.truncated).toBe(true);
  });

  test('invalidate marks the row invalidated without destroying the snapshot', async () => {
    await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }]);
    await snapshot.invalidateSnapshot('u1', ['likes']);

    // A distinct status from the 'stale' default, which now means only
    // "never completed" — the two used to share a word and needed comments
    // to keep apart.
    expect(state.rows.get('u1::likes').status).toBe('invalidated');
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

describe('invalidateSnapshot with syncedAtLte', () => {
  // publishSnapshot uses this so a writer that lost a race against a mutation
  // invalidates only the row IT wrote — not a newer, correct snapshot another
  // crawl committed in the meantime, which would force a needless re-crawl.
  test('skips a row newer than the stamp', async () => {
    const first = await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }]);
    // A newer crawl replaced the row after `first` returned.
    const newer = new Date(first.syncedAt.getTime() + 5_000);
    state.rows.set('u1::likes', { ...state.rows.get('u1::likes'), syncedAt: newer });

    const result = await snapshot.invalidateSnapshot('u1', ['likes'], { syncedAtLte: first.syncedAt });

    expect(result.count).toBe(0);
    expect(state.rows.get('u1::likes').status).toBe('complete');
    expect(await snapshot.readSnapshot('u1', 'likes')).not.toBeNull();
  });

  test('invalidates a row at or before the stamp', async () => {
    const written = await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }]);

    const result = await snapshot.invalidateSnapshot('u1', ['likes'], { syncedAtLte: written.syncedAt });

    expect(result.count).toBe(1);
    expect(state.rows.get('u1::likes').status).toBe('invalidated');
  });

  test('an unusable stamp falls back to unconditional', async () => {
    // A soft-failed write returns null, and social-cache passes that through;
    // the compensating invalidate must still fire rather than silently no-op.
    await snapshot.writeSnapshot('u1', 'likes', [{ id: 1 }]);
    for (const bad of [null, undefined, 'not a date', new Date('garbage')]) {
      state.rows.set('u1::likes', { ...state.rows.get('u1::likes'), status: 'complete' });
      const result = await snapshot.invalidateSnapshot('u1', ['likes'], { syncedAtLte: bad });
      expect(result.count).toBe(1);
    }
  });
});
