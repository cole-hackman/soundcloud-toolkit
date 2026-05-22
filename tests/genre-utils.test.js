import { normalizeGenre } from '../server/lib/genre-utils.js';

describe('normalizeGenre', () => {
  test('lowercases, trims, collapses whitespace', () => {
    expect(normalizeGenre('  Tech   House ')).toBe('tech house');
  });
  test('strips non-alphanumeric separators so techhouse matches tech house variants', () => {
    expect(normalizeGenre('Tech-House')).toBe('tech house');
    expect(normalizeGenre('Tech/House')).toBe('tech house');
  });
  test('returns null for empty or non-string input', () => {
    expect(normalizeGenre('')).toBeNull();
    expect(normalizeGenre(null)).toBeNull();
    expect(normalizeGenre(42)).toBeNull();
  });
});
