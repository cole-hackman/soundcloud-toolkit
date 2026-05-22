import { expandGenreAliases } from '../server/lib/genre-aliases.js';

describe('expandGenreAliases', () => {
  test('returns the normalized input when no alias matches', () => {
    expect(expandGenreAliases('Ambient')).toEqual(['ambient']);
  });

  test('expands a well-known alias to its full equivalence class', () => {
    const aliases = expandGenreAliases('dnb');
    expect(aliases).toEqual(expect.arrayContaining(['drum and bass', 'dnb']));
  });

  test('any member of an equivalence class returns the same class', () => {
    const a = expandGenreAliases('drum and bass').sort();
    const b = expandGenreAliases('d&b').sort();
    const c = expandGenreAliases('jungle').sort();
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });

  test('tech house variants collapse', () => {
    expect(expandGenreAliases('Tech-House').sort()).toEqual(expandGenreAliases('techhouse').sort());
  });

  test('returns [] for empty/non-string input', () => {
    expect(expandGenreAliases('')).toEqual([]);
    expect(expandGenreAliases(null)).toEqual([]);
    expect(expandGenreAliases(42)).toEqual([]);
  });
});
