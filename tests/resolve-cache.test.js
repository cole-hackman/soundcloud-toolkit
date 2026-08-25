const { getCachedResolve, setCachedResolve, resolveCacheSize, clearResolveCache } =
  await import('../server/lib/resolve-cache.js');

beforeEach(() => clearResolveCache());

test('set then get round-trips', () => {
  setCachedResolve('https://soundcloud.com/a', { id: 1 });
  expect(getCachedResolve('https://soundcloud.com/a')).toEqual({ id: 1 });
});

test('unknown keys return undefined', () => {
  expect(getCachedResolve('https://soundcloud.com/nope')).toBeUndefined();
});

test('cache is capped at 1000 entries', () => {
  for (let i = 0; i < 1200; i++) setCachedResolve(`https://soundcloud.com/t${i}`, { i });
  expect(resolveCacheSize()).toBeLessThanOrEqual(1001); // prune runs before insert
});
