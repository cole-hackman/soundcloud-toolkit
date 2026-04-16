import { dedupeTrackIds, mergePlaylistsTrackIds, mergeIntoExisting, splitIntoChunks } from '../server/lib/merge-utils.js';

describe('merge utils', () => {
  test('dedupe track ids preserves order', () => {
    const input = [1, 2, 2, 3, 1, 4];
    expect(dedupeTrackIds(input)).toEqual([1, 2, 3, 4]);
  });

  test('merge playlists yields unique ids', () => {
    const a = { tracks: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    const b = { tracks: [{ id: 2 }, { id: 4 }] };
    expect(mergePlaylistsTrackIds([a, b])).toEqual([1, 2, 3, 4]);
  });
});

describe('mergeIntoExisting', () => {
  test('appends new unique tracks after existing', () => {
    const result = mergeIntoExisting([1, 2, 3], [3, 4, 5]);
    expect(result.mergedIds).toEqual([1, 2, 3, 4, 5]);
    expect(result.addedCount).toBe(2);
  });

  test('preserves existing order', () => {
    const result = mergeIntoExisting([10, 20, 30], [5, 15]);
    expect(result.mergedIds.slice(0, 3)).toEqual([10, 20, 30]);
  });

  test('returns addedCount 0 when all source IDs already exist', () => {
    const result = mergeIntoExisting([1, 2, 3], [2, 3, 1]);
    expect(result.mergedIds).toEqual([1, 2, 3]);
    expect(result.addedCount).toBe(0);
  });

  test('handles empty existing array', () => {
    const result = mergeIntoExisting([], [1, 2, 3]);
    expect(result.mergedIds).toEqual([1, 2, 3]);
    expect(result.addedCount).toBe(3);
  });

  test('handles empty source array', () => {
    const result = mergeIntoExisting([1, 2], []);
    expect(result.mergedIds).toEqual([1, 2]);
    expect(result.addedCount).toBe(0);
  });

  test('deduplicates within source IDs', () => {
    const result = mergeIntoExisting([1], [2, 2, 3, 3]);
    expect(result.mergedIds).toEqual([1, 2, 3]);
    expect(result.addedCount).toBe(2);
  });
});

describe('splitIntoChunks', () => {
  test('splits array into chunks of maxSize', () => {
    const ids = [1, 2, 3, 4, 5];
    const chunks = splitIntoChunks(ids, 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('returns single chunk when array fits within maxSize', () => {
    const ids = [1, 2, 3];
    const chunks = splitIntoChunks(ids, 500);
    expect(chunks).toEqual([[1, 2, 3]]);
  });

  test('returns empty array for empty input', () => {
    expect(splitIntoChunks([], 500)).toEqual([]);
  });

  test('defaults maxSize to 500', () => {
    const ids = Array.from({ length: 501 }, (_, i) => i + 1);
    const chunks = splitIntoChunks(ids);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(500);
    expect(chunks[1].length).toBe(1);
  });
});


