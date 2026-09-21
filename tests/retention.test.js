import { jest } from '@jest/globals';

// A fixed clock so every cutoff assertion is an exact date, not a tolerance.
const NOW = Date.parse('2026-09-22T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (days) => new Date(NOW - days * DAY_MS);

// Each bulk statement resolves with a distinct row count so the log-line
// assertions can tell the steps apart. The counts are re-applied in beforeEach
// rather than set once, because one test deliberately makes everything reject.
const DEFAULT_COUNTS = new Map();
const ok = (count = 0) => {
  const fn = jest.fn();
  DEFAULT_COUNTS.set(fn, count);
  return fn;
};

const libraryCachePageDeleteMany = ok(3);
const libraryCacheStateDeleteMany = ok(2);
const userDeleteMany = ok(1);
const operationLogDeleteMany = ok(40);
const operationLogFindMany = jest.fn();
const growthActionDeleteMany = ok(7);
const feedbackDeleteMany = ok(1);
const betaSignupUpdateMany = ok(5);
const trackUpdateMany = ok(9);
const metricFindUnique = jest.fn();
const metricUpsert = jest.fn();

const prismaMock = {
  libraryCachePage: { deleteMany: libraryCachePageDeleteMany },
  libraryCacheState: { deleteMany: libraryCacheStateDeleteMany },
  user: { deleteMany: userDeleteMany },
  operationLog: { deleteMany: operationLogDeleteMany, findMany: operationLogFindMany },
  growthAction: { deleteMany: growthActionDeleteMany },
  feedback: { deleteMany: feedbackDeleteMany },
  betaSignup: { updateMany: betaSignupUpdateMany },
  track: { updateMany: trackUpdateMany },
  metric: { findUnique: metricFindUnique, upsert: metricUpsert },
};

jest.unstable_mockModule('../server/lib/prisma.js', () => ({ default: prismaMock }));

const { runRetentionOnce, startRetentionScheduler, LIFETIME_METRIC_KEY } =
  await import('../server/lib/retention.js');

const infoSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

afterAll(() => { infoSpy.mockRestore(); errorSpy.mockRestore(); });

beforeEach(() => {
  // mockReset, not mockClear: implementations have to go too, or the
  // "everything rejects" test poisons every later one.
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model)) {
      fn.mockReset();
      if (DEFAULT_COUNTS.has(fn)) fn.mockResolvedValue({ count: DEFAULT_COUNTS.get(fn) });
    }
  }
  infoSpy.mockClear();
  errorSpy.mockClear();
  operationLogFindMany.mockResolvedValue([{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]);
  metricFindUnique.mockResolvedValue(null);
  metricUpsert.mockResolvedValue({});
});

const logLines = () => infoSpy.mock.calls.map((c) => c.join(' '));

describe('cutoff dates', () => {
  test('library cache pages age by createdAt, states by updatedAt, both at 7 days', async () => {
    await runRetentionOnce(NOW);

    expect(libraryCachePageDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: daysBefore(7) } },
    });
    expect(libraryCacheStateDeleteMany).toHaveBeenCalledWith({
      where: { updatedAt: { lt: daysBefore(7) } },
    });
  });

  test('CACHE_TTL_DAYS overrides the cache window', async () => {
    process.env.CACHE_TTL_DAYS = '2';
    try {
      await runRetentionOnce(NOW);
      expect(libraryCachePageDeleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: daysBefore(2) } },
      });
    } finally {
      delete process.env.CACHE_TTL_DAYS;
    }
  });

  test('disconnected accounts are removed after a 7-day grace period', async () => {
    await runRetentionOnce(NOW);

    expect(userDeleteMany).toHaveBeenNthCalledWith(1, {
      where: { disconnectedAt: { lt: daysBefore(7) } },
    });
  });

  test('inactive accounts use calendar months, with updatedAt as the fallback', async () => {
    await runRetentionOnce(NOW);

    // 24 calendar months before 2026-09-22 is 2024-09-22 — not 730 days.
    const expected = new Date('2024-09-22T12:00:00.000Z');
    expect(userDeleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        OR: [
          { lastLoginAt: { lt: expected } },
          { AND: [{ lastLoginAt: null }, { updatedAt: { lt: expected } }] },
        ],
      },
    });
  });

  test('INACTIVE_MONTHS overrides the dormancy window', async () => {
    process.env.INACTIVE_MONTHS = '6';
    try {
      await runRetentionOnce(NOW);
      const where = userDeleteMany.mock.calls[1][0].where;
      expect(where.OR[0].lastLoginAt.lt).toEqual(new Date('2026-03-22T12:00:00.000Z'));
    } finally {
      delete process.env.INACTIVE_MONTHS;
    }
  });

  test('operation logs, growth actions and feedback use their own windows', async () => {
    await runRetentionOnce(NOW);

    expect(operationLogDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: daysBefore(365) } },
    });
    expect(growthActionDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: daysBefore(365) } },
    });
    expect(feedbackDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: daysBefore(730) } },
    });
  });

  test('OPLOG_RETENTION_DAYS overrides the log window', async () => {
    process.env.OPLOG_RETENTION_DAYS = '30';
    try {
      await runRetentionOnce(NOW);
      expect(operationLogDeleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: daysBefore(30) } },
      });
    } finally {
      delete process.env.OPLOG_RETENTION_DAYS;
    }
  });
});

describe('unconditional steps', () => {
  test('beta signup emails are nulled every run, not aged out', async () => {
    await runRetentionOnce(NOW);
    expect(betaSignupUpdateMany).toHaveBeenCalledWith({
      where: { email: { not: null } },
      data: { email: null },
    });
  });

  test("catalog rows for tracks deleted upstream lose their metadata, not their id", async () => {
    await runRetentionOnce(NOW);
    expect(trackUpdateMany).toHaveBeenCalledWith({
      where: { access: 'gone', title: { not: null } },
      data: {
        title: null,
        artistName: null,
        genre: null,
        genreNormalized: null,
        permalinkUrl: null,
      },
    });
  });
});

describe('lifetime distinct-user snapshot', () => {
  test('creates the metric from the live count when it does not exist', async () => {
    metricFindUnique.mockResolvedValue(null);

    await runRetentionOnce(NOW);

    expect(operationLogFindMany).toHaveBeenCalledWith({
      distinct: ['userId'],
      select: { userId: true },
    });
    expect(metricUpsert).toHaveBeenCalledWith({
      where: { key: LIFETIME_METRIC_KEY },
      create: { key: LIFETIME_METRIC_KEY, value: 3n },
      update: { value: 3n },
    });
  });

  test('keeps the stored maximum when the live count has shrunk after a purge', async () => {
    // The whole point: yesterday's purge removed rows, so today's live count
    // is lower. The all-time figure must not follow it down.
    metricFindUnique.mockResolvedValue({ key: LIFETIME_METRIC_KEY, value: 900n });

    await runRetentionOnce(NOW);

    expect(metricUpsert.mock.calls[0][0].update).toEqual({ value: 900n });
  });

  test('raises the metric when the live count has grown', async () => {
    metricFindUnique.mockResolvedValue({ key: LIFETIME_METRIC_KEY, value: 1n });

    await runRetentionOnce(NOW);

    expect(metricUpsert.mock.calls[0][0].update).toEqual({ value: 3n });
  });

  test('the snapshot is taken BEFORE the logs it is computed from are purged', async () => {
    await runRetentionOnce(NOW);

    expect(metricUpsert.mock.invocationCallOrder[0])
      .toBeLessThan(operationLogDeleteMany.mock.invocationCallOrder[0]);
  });
});

describe('step isolation', () => {
  test('one failing step does not stop the others', async () => {
    userDeleteMany.mockRejectedValueOnce(new Error('deadlock'));

    const results = await runRetentionOnce(NOW);

    expect(results['disconnected-users']).toBeNull();
    // Everything downstream still ran.
    expect(userDeleteMany).toHaveBeenCalledTimes(2); // the inactive sweep too
    expect(metricUpsert).toHaveBeenCalled();
    expect(operationLogDeleteMany).toHaveBeenCalled();
    expect(betaSignupUpdateMany).toHaveBeenCalled();
    expect(trackUpdateMany).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  test('a failing metric snapshot still lets the log purge run', async () => {
    metricFindUnique.mockRejectedValueOnce(new Error('no metrics table'));

    const results = await runRetentionOnce(NOW);

    expect(results['lifetime-users-metric']).toBeNull();
    expect(operationLogDeleteMany).toHaveBeenCalled();
  });

  test('runRetentionOnce never rejects, even if every step throws', async () => {
    for (const model of Object.values(prismaMock)) {
      for (const fn of Object.values(model)) fn.mockRejectedValue(new Error('everything is down'));
    }

    await expect(runRetentionOnce(NOW)).resolves.toEqual(expect.any(Object));
  });
});

describe('logging', () => {
  test('each step reports its count in the [retention] <step> removed N shape', async () => {
    await runRetentionOnce(NOW);

    const lines = logLines();
    expect(lines).toEqual(expect.arrayContaining([
      '[INFO] [retention] library-cache-pages removed 3',
      '[INFO] [retention] library-cache-states removed 2',
      '[INFO] [retention] disconnected-users removed 1',
      '[INFO] [retention] inactive-users removed 1',
      '[INFO] [retention] operation-logs removed 40',
      '[INFO] [retention] growth-actions removed 7',
      '[INFO] [retention] feedback removed 1',
      '[INFO] [retention] beta-signup-emails removed 5',
      '[INFO] [retention] catalog-gone-metadata removed 9',
    ]));
  });

  test('the metric step does not claim to have removed anything', async () => {
    await runRetentionOnce(NOW);

    const lines = logLines();
    expect(lines).toContain('[INFO] [retention] lifetime-users-metric snapshot 3');
    expect(lines).not.toContain('[INFO] [retention] lifetime-users-metric removed 3');
  });

  test('no log line carries a soundcloudId or any user identifier', async () => {
    await runRetentionOnce(NOW);
    for (const line of logLines()) {
      expect(line).not.toMatch(/soundcloudId/i);
      expect(line).not.toMatch(/user-[a-z0-9]/i);
    }
  });
});

describe('the Feedback model may not exist yet', () => {
  test('the job still completes when prisma.feedback is absent', async () => {
    const { feedback, ...rest } = prismaMock;
    // Simulate a client generated before the feedback feature landed.
    delete prismaMock.feedback;
    try {
      const results = await runRetentionOnce(NOW);
      expect(results['feedback']).toBe(0);
      // And the steps after it still ran.
      expect(betaSignupUpdateMany).toHaveBeenCalled();
      expect(trackUpdateMany).toHaveBeenCalled();
    } finally {
      prismaMock.feedback = feedback;
      void rest;
    }
  });
});

describe('scheduler', () => {
  beforeEach(() => { jest.useFakeTimers({ now: NOW }); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test('RETENTION_ENABLED=false disables it entirely', () => {
    process.env.RETENTION_ENABLED = 'false';
    try {
      expect(startRetentionScheduler()).toBeNull();
      jest.advanceTimersByTime(40 * DAY_MS);
      expect(operationLogDeleteMany).not.toHaveBeenCalled();
    } finally {
      delete process.env.RETENTION_ENABLED;
    }
  });

  test('unset means enabled — a retention policy that is off by default is not one', async () => {
    const interval = startRetentionScheduler();
    expect(interval).not.toBeNull();

    // Nothing at boot: the first sweep waits 10 minutes.
    expect(operationLogDeleteMany).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10 * 60 * 1000);
    await Promise.resolve();
    expect(libraryCachePageDeleteMany).toHaveBeenCalled();

    clearInterval(interval);
  });

  test('RETENTION_INTERVAL_MS sets the repeat period', async () => {
    process.env.RETENTION_INTERVAL_MS = String(60 * 60 * 1000);
    try {
      const interval = startRetentionScheduler();
      jest.advanceTimersByTime(10 * 60 * 1000);
      await Promise.resolve();
      const afterFirst = libraryCachePageDeleteMany.mock.calls.length;

      jest.advanceTimersByTime(60 * 60 * 1000);
      await Promise.resolve();
      expect(libraryCachePageDeleteMany.mock.calls.length).toBeGreaterThan(afterFirst);

      clearInterval(interval);
    } finally {
      delete process.env.RETENTION_INTERVAL_MS;
    }
  });
});
