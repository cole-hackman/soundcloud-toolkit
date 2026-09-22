/**
 * RETENTION_DRY_RUN — the sweep that counts and writes nothing.
 *
 * Why this exists as its own suite rather than a case in retention.test.js:
 * the property under test is negative ("no write happens"), and the only
 * honest way to assert a negative is to give the mocked client EVERY mutating
 * method it has and check that none of them was called. That means a client
 * mock built from a list of method names, which is a different shape from the
 * per-step mocks the main suite uses for its cutoff assertions.
 *
 * The list below is the contract: add a mutating call anywhere in
 * `runRetentionOnce` without adding it here and the "nothing was written"
 * assertion is silently weaker. `MUTATING` is checked against the mock's own
 * surface in the first test so a typo cannot quietly drop an entry.
 */
import { jest } from '@jest/globals';

const NOW = Date.parse('2026-09-22T12:00:00.000Z');

/** Every write the job can issue, as `<delegate>.<method>`. */
const MUTATING = [
  'libraryCachePage.deleteMany',
  'libraryCacheState.deleteMany',
  'user.deleteMany',
  'operationLog.deleteMany',
  'growthAction.deleteMany',
  'feedback.deleteMany',
  'betaSignup.updateMany',
  'track.updateMany',
  'metric.upsert',
];

/** Every read it can issue. The counts each step reports come from these. */
const READING = [
  'libraryCachePage.count',
  'libraryCacheState.count',
  'user.count',
  'operationLog.count',
  'growthAction.count',
  'feedback.count',
  'betaSignup.count',
  'track.count',
  'metric.findUnique',
];

const prismaMock = {};
for (const path of [...MUTATING, ...READING]) {
  const [delegate, method] = path.split('.');
  prismaMock[delegate] ??= {};
  prismaMock[delegate][method] = jest.fn();
}
prismaMock.$queryRaw = jest.fn();

jest.unstable_mockModule('../server/lib/prisma.js', () => ({ default: prismaMock }));

const { runRetentionOnce, isRetentionDryRun, startRetentionScheduler } =
  await import('../server/lib/retention.js');

const infoSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
afterAll(() => { infoSpy.mockRestore(); errorSpy.mockRestore(); });

const at = (path) => {
  const [delegate, method] = path.split('.');
  return prismaMock[delegate][method];
};
const logLines = () => infoSpy.mock.calls.map((c) => c.join(' '));

beforeEach(() => {
  for (const path of MUTATING) at(path).mockReset().mockResolvedValue({ count: 99 });
  // Distinct counts so a log line can be traced back to the step that wrote it.
  const counts = {
    'libraryCachePage.count': 3,
    'libraryCacheState.count': 2,
    'user.count': 12,
    'operationLog.count': 40,
    'growthAction.count': 7,
    'feedback.count': 1,
    'betaSignup.count': 5,
    'track.count': 9,
  };
  for (const [path, value] of Object.entries(counts)) at(path).mockReset().mockResolvedValue(value);
  at('metric.findUnique').mockReset().mockResolvedValue(null);
  prismaMock.$queryRaw.mockReset().mockResolvedValue([{ count: 3 }]);
  infoSpy.mockClear();
  errorSpy.mockClear();
  delete process.env.RETENTION_DRY_RUN;
});

describe('RETENTION_DRY_RUN', () => {
  test('the mutating list matches the mock surface, so "nothing was written" is exhaustive', () => {
    const onMock = [];
    for (const [delegate, methods] of Object.entries(prismaMock)) {
      if (typeof methods !== 'object') continue;
      for (const method of Object.keys(methods)) {
        if (/^(delete|update|upsert|create)/.test(method)) onMock.push(`${delegate}.${method}`);
      }
    }
    expect(onMock.sort()).toEqual([...MUTATING].sort());
  });

  test('issues NO write at all', async () => {
    process.env.RETENTION_DRY_RUN = 'true';
    await runRetentionOnce(NOW);

    // Named as a list rather than asserted one-by-one so a failure says which
    // write escaped, not merely that one did.
    expect(MUTATING.filter((path) => at(path).mock.calls.length > 0)).toEqual([]);
  });

  test('still performs every count, so the numbers are real', async () => {
    process.env.RETENTION_DRY_RUN = 'true';
    await runRetentionOnce(NOW);

    expect(READING.filter((path) => at(path).mock.calls.length === 0)).toEqual([]);
    // Two user sweeps (disconnected, then dormant), each with its own `where`.
    expect(at('user.count')).toHaveBeenCalledTimes(2);
  });

  test('logs a `would remove N` line for every step, with the counted values', async () => {
    process.env.RETENTION_DRY_RUN = 'true';
    await runRetentionOnce(NOW);

    expect(logLines()).toEqual(expect.arrayContaining([
      '[INFO] [retention] DRY RUN (RETENTION_DRY_RUN=true) — counting only, nothing is written',
      '[INFO] [retention] library-cache-pages would remove 3',
      '[INFO] [retention] library-cache-states would remove 2',
      '[INFO] [retention] disconnected-users would remove 12',
      '[INFO] [retention] inactive-users would remove 12',
      '[INFO] [retention] operation-logs would remove 40',
      '[INFO] [retention] growth-actions would remove 7',
      '[INFO] [retention] feedback would remove 1',
      '[INFO] [retention] beta-signup-emails would remove 5',
      '[INFO] [retention] catalog-gone-metadata would remove 9',
      '[INFO] [retention] DRY RUN complete — no rows were deleted or updated',
    ]));
    // No line may claim something was removed.
    for (const line of logLines()) expect(line).not.toMatch(/\] \S+ removed /);
  });

  test('prints the same `will remove N users` line a real sweep would', async () => {
    // This is the line STATE.md tells Cole to read. If the dry run worded it
    // differently he would be comparing two things that only look alike.
    process.env.RETENTION_DRY_RUN = 'true';
    await runRetentionOnce(NOW);
    expect(logLines()).toEqual(expect.arrayContaining([
      '[INFO] [retention] disconnected-users will remove 12 users',
      '[INFO] [retention] inactive-users will remove 12 users',
    ]));
  });

  test('returns the counted values as the per-step result', async () => {
    process.env.RETENTION_DRY_RUN = 'true';
    const results = await runRetentionOnce(NOW);
    expect(results).toMatchObject({
      'library-cache-pages': 3,
      'disconnected-users': 12,
      'operation-logs': 40,
      'catalog-gone-metadata': 9,
    });
  });

  test('the lifetime metric is computed but not stored', async () => {
    process.env.RETENTION_DRY_RUN = 'true';
    const results = await runRetentionOnce(NOW);
    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    expect(at('metric.upsert')).not.toHaveBeenCalled();
    expect(results['lifetime-users-metric']).toBe(3);
  });

  test('a failing count is isolated like any other step, and still writes nothing', async () => {
    process.env.RETENTION_DRY_RUN = 'true';
    at('operationLog.count').mockRejectedValue(new Error('boom'));

    const results = await runRetentionOnce(NOW);

    expect(results['operation-logs']).toBeNull();
    // The steps after it still ran.
    expect(results['catalog-gone-metadata']).toBe(9);
    expect(MUTATING.filter((path) => at(path).mock.calls.length > 0)).toEqual([]);
  });

  test('without the flag the sweep writes normally — the guard is the flag, not the refactor', async () => {
    await runRetentionOnce(NOW);
    expect(MUTATING.filter((path) => at(path).mock.calls.length === 0)).toEqual([]);
    expect(logLines()).not.toEqual(expect.arrayContaining([
      expect.stringContaining('DRY RUN'),
    ]));
  });

  test.each([
    ['true', true],
    ['TRUE', true],
    ['  true  ', true],
    ['false', false],
    // '1' and 'yes' are NOT accepted: a dry run that silently became real
    // because of a plausible-looking value is the failure mode here.
    ['1', false],
    ['yes', false],
    ['', false],
  ])('RETENTION_DRY_RUN=%j is dry-run %s', (value, expected) => {
    expect(isRetentionDryRun({ RETENTION_DRY_RUN: value })).toBe(expected);
  });

  test('an unset variable is a real run', () => {
    expect(isRetentionDryRun({})).toBe(false);
  });

});

/**
 * Fake timers, like the scheduler cases in retention.test.js: the scheduler
 * arms a ten-minute `setTimeout` for the first run, and a real one holds the
 * Node process open long past the end of the suite.
 */
describe('RETENTION_DRY_RUN at boot', () => {
  beforeEach(() => { jest.useFakeTimers({ now: NOW }); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test('RETENTION_ENABLED=false still schedules nothing, and says so', () => {
    process.env.RETENTION_ENABLED = 'false';
    try {
      expect(startRetentionScheduler()).toBeNull();
      const line = logLines().find((l) => l.includes('RETENTION_ENABLED=false'));
      // The message has to point at the thing that does produce counts, or the
      // next person repeats the mistake this flag was added to fix.
      expect(line).toContain('no run, and therefore no counts');
      expect(line).toContain('RETENTION_DRY_RUN=true');
    } finally {
      delete process.env.RETENTION_ENABLED;
    }
  });

  test('the scheduler names dry-run mode at boot', () => {
    process.env.RETENTION_DRY_RUN = 'true';
    startRetentionScheduler();
    expect(logLines().some((l) => l.includes('DRY RUN mode'))).toBe(true);
  });

  test('the scheduled run itself writes nothing while the flag is set', async () => {
    process.env.RETENTION_DRY_RUN = 'true';
    startRetentionScheduler();

    // Reach the first run the same way production would: by waiting.
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
    for (let i = 0; i < 60; i++) await Promise.resolve();

    expect(logLines().some((l) => l.includes('DRY RUN complete'))).toBe(true);
    expect(MUTATING.filter((path) => at(path).mock.calls.length > 0)).toEqual([]);
  });
});
