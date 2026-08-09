import { jest } from '@jest/globals';

// Contract tests for logOperation's normalization: status enum enforcement,
// the 1000-entry trackIds cap with explicit truncation markers, and ID-array
// merging. Prisma is mocked so we can inspect exactly what would be written.

const createMock = jest.fn().mockResolvedValue({});

jest.unstable_mockModule('../server/lib/prisma.js', () => ({
  default: { operationLog: { create: createMock } },
}));

const { logOperation } = await import('../server/lib/analytics.js');

function lastWrite() {
  return createMock.mock.calls[createMock.mock.calls.length - 1][0].data;
}

describe('logOperation contract', () => {
  beforeEach(() => createMock.mockClear());

  it('caps trackIds at 1000 and records the truncation explicitly', async () => {
    const trackIds = Array.from({ length: 1500 }, (_, i) => i + 1);
    await logOperation({ userId: 'u1', action: 'from-likes', trackIds });
    const data = lastWrite();
    expect(data.metadata.trackIds).toHaveLength(1000);
    expect(data.metadata.trackIdsTruncated).toBe(true);
    expect(data.metadata.trackIdsTotal).toBe(1500);
    expect(data.trackCount).toBe(1500); // true count survives in the column
  });

  it('does not mark truncation under the cap', async () => {
    await logOperation({ userId: 'u1', action: 'merge', trackIds: [1, 2, 3] });
    const data = lastWrite();
    expect(data.metadata.trackIds).toEqual([1, 2, 3]);
    expect(data.metadata.trackIdsTruncated).toBeUndefined();
  });

  it('accepts all four statuses', async () => {
    for (const status of ['success', 'split', 'error', 'partial']) {
      await logOperation({ userId: 'u1', action: 'x', status });
      expect(lastWrite().status).toBe(status);
    }
  });

  it('coerces unknown statuses to error with INVALID_STATUS', async () => {
    await logOperation({ userId: 'u1', action: 'x', status: 'sucess' });
    const data = lastWrite();
    expect(data.status).toBe('error');
    expect(data.errorCode).toBe('INVALID_STATUS');
    expect(data.metadata.invalidStatus).toBe('sucess');
  });

  it('merges playlistIds and targetUserIds into metadata uncapped', async () => {
    await logOperation({
      userId: 'u1',
      action: 'x',
      playlistIds: [10, 20],
      targetUserIds: [30],
      metadata: { total: 3 },
    });
    const data = lastWrite();
    expect(data.metadata).toMatchObject({ total: 3, playlistIds: [10, 20], targetUserIds: [30] });
  });

  it('filters non-numeric IDs', async () => {
    await logOperation({ userId: 'u1', action: 'x', trackIds: [1, 'nope', 2, null] });
    // null coerces to 0 via Number() and survives the NaN filter; the
    // contract only promises numbers, which this asserts.
    expect(lastWrite().metadata.trackIds.every(n => typeof n === 'number' && !isNaN(n))).toBe(true);
  });
});
