/**
 * The boot-time schema check.
 *
 * The case that matters most is the last one: it reproduces the 2026-09-23
 * outage exactly — a `users` table with no `lastLoginAt` — and asserts the
 * process refuses to start and names the file that creates the column. That
 * deploy shipped, booted cleanly, served the landing page, and broke every
 * authenticated request; the first signal anyone got was a user seeing
 * `?error=callback_failed`.
 *
 * The rest of the suite guards the two ways this check could rot into
 * uselessness: tolerating a table that actually matters, and quietly verifying
 * nothing when it cannot read Prisma's data model.
 */

import { jest } from '@jest/globals';

const { expectedSchema, diffSchema, verifySchema, __testing } =
  await import('../server/lib/schema-preflight.js');

/** A Prisma-client-shaped double. Only the fields the check reads. */
function fakeClient(models, { rows = [], queryError = null } = {}) {
  return {
    _runtimeDataModel: { models },
    $queryRawUnsafe: async () => {
      if (queryError) throw queryError;
      return rows;
    },
  };
}

const USERS_MODEL = {
  User: {
    dbName: 'users',
    fields: [
      { name: 'id', kind: 'scalar' },
      { name: 'lastLoginAt', kind: 'scalar' },
      { name: 'disconnectedAt', kind: 'scalar' },
      { name: 'tokens', kind: 'object' }, // relation — not a column
    ],
  },
};

const present = (pairs) =>
  new Map(Object.entries(pairs).map(([t, cols]) => [t, new Set(cols)]));

describe('expectedSchema', () => {
  it('reads tables and scalar columns, ignoring relation fields', () => {
    const [users] = expectedSchema(fakeClient(USERS_MODEL));
    expect(users).toEqual({
      model: 'User',
      table: 'users',
      columns: ['id', 'lastLoginAt', 'disconnectedAt'],
    });
  });

  it('prefers a column @map over the field name', () => {
    const [model] = expectedSchema(
      fakeClient({ M: { dbName: 't', fields: [{ name: 'camel', dbName: 'snake', kind: 'scalar' }] } })
    );
    expect(model.columns).toEqual(['snake']);
  });

  it('throws rather than checking nothing when the data model is unreadable', () => {
    // A Prisma upgrade moving this internal API must fail the boot loudly. A
    // guard that silently verifies zero tables is worse than no guard, because
    // it reports success.
    expect(() => expectedSchema({})).toThrow(/cannot read the Prisma runtime data model/);
  });
});

describe('diffSchema', () => {
  const expected = expectedSchema(fakeClient(USERS_MODEL));

  it('passes when every column is present', () => {
    const out = diffSchema(expected, present({ users: ['id', 'lastLoginAt', 'disconnectedAt'] }));
    expect(out).toEqual({ fatal: [], tolerated: [] });
  });

  it('reports a missing table as fatal and names the file that creates it', () => {
    const { fatal } = diffSchema(expected, present({}));
    expect(fatal).toHaveLength(1);
    expect(fatal[0]).toMatch(/table "users" \(model User\) is missing/);
    expect(fatal[0]).toContain('2026-09-account-lifecycle.sql');
  });

  it('lists EVERY missing column in one pass, not just the first', () => {
    // Someone fixing this under pressure should get the whole list at once
    // rather than discovering the next one on the next redeploy.
    const { fatal } = diffSchema(expected, present({ users: ['id'] }));
    expect(fatal).toHaveLength(1);
    expect(fatal[0]).toContain('"lastLoginAt"');
    expect(fatal[0]).toContain('"disconnectedAt"');
  });

  it('tolerates the other branch\'s tables instead of refusing to boot for them', () => {
    const chat = expectedSchema(
      fakeClient({ chat_messages: { dbName: 'chat_messages', fields: [{ name: 'id', kind: 'scalar' }] } })
    );
    const { fatal, tolerated } = diffSchema(chat, present({}));
    expect(fatal).toEqual([]);
    expect(tolerated).toHaveLength(1);
  });
});

describe('verifySchema', () => {
  it('exits non-zero when a required object is missing', async () => {
    const exit = jest.fn();
    const client = fakeClient(USERS_MODEL, { rows: [{ table_name: 'users', column_name: 'id' }] });

    const result = await verifySchema({ client, exit });

    expect(exit).toHaveBeenCalledWith(1);
    expect(result.verified).toBe(false);
  });

  it('does not exit for a tolerated table', async () => {
    const exit = jest.fn();
    const client = fakeClient(
      { chat_messages: { dbName: 'chat_messages', fields: [{ name: 'id', kind: 'scalar' }] } },
      { rows: [] }
    );

    const result = await verifySchema({ client, exit });

    expect(exit).not.toHaveBeenCalled();
    expect(result.verified).toBe(true);
    expect(result.tolerated).toHaveLength(1);
  });

  it('does NOT exit when the database is unreachable', async () => {
    // Reachability is not correctness. Exiting on a connection blip would turn
    // a transient upstream problem into a restart loop, and the static site
    // serves fine without a database.
    const exit = jest.fn();
    const client = fakeClient(USERS_MODEL, { queryError: new Error('ECONNREFUSED') });

    const result = await verifySchema({ client, exit });

    expect(exit).not.toHaveBeenCalled();
    expect(result.verified).toBe(false);
    expect(result.fatal).toEqual([]);
  });

  it('reports verified when everything is present', async () => {
    const exit = jest.fn();
    const client = fakeClient(USERS_MODEL, {
      rows: ['id', 'lastLoginAt', 'disconnectedAt'].map((c) => ({
        table_name: 'users',
        column_name: c,
      })),
    });

    const result = await verifySchema({ client, exit });

    expect(exit).not.toHaveBeenCalled();
    expect(result.verified).toBe(true);
  });
});

describe('the tolerated list cannot rot', () => {
  it('every tolerated name is still a real model or table in the Prisma client', async () => {
    // Without this, a table could be renamed or become load-bearing while the
    // check quietly keeps excusing its absence — the same shape as a gate that
    // reads a stale copy of what it claims to cover.
    const prisma = (await import('../server/lib/prisma.js')).default;
    const known = new Set();
    for (const { model, table } of expectedSchema(prisma)) {
      known.add(model);
      known.add(table);
    }

    for (const name of __testing.NON_FATAL_TABLES) {
      expect(known.has(name)).toBe(true);
    }
  });

  it('every table named in TABLE_SOURCE is still a real table', async () => {
    const prisma = (await import('../server/lib/prisma.js')).default;
    const tables = new Set(expectedSchema(prisma).map((e) => e.table));
    for (const table of Object.keys(__testing.TABLE_SOURCE)) {
      expect(tables.has(table)).toBe(true);
    }
  });
});

describe('the 2026-09-23 outage', () => {
  it('refuses to start against the database that caused it', async () => {
    // Exactly the production state that morning: users exists, the two
    // lifecycle columns do not. Before this check, that booted cleanly and
    // broke every authenticated request.
    const exit = jest.fn();
    const errors = [];
    const client = fakeClient(USERS_MODEL, {
      rows: [{ table_name: 'users', column_name: 'id' }],
    });

    const logger = (await import('../server/lib/logger.js')).default;
    const spy = jest.spyOn(logger, 'error').mockImplementation((m) => errors.push(String(m)));

    await verifySchema({ client, exit });
    spy.mockRestore();

    expect(exit).toHaveBeenCalledWith(1);
    const joined = errors.join('\n');
    expect(joined).toMatch(/REFUSING TO START/);
    expect(joined).toContain('lastLoginAt');
    expect(joined).toContain('2026-09-account-lifecycle.sql');
  });
});
