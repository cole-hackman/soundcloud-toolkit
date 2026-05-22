import { searchLikes, countLikesByArtist } from '../server/lib/library-index.js';

/**
 * In-memory fake Prisma that supports: where.userId, where.artistName.contains
 * (insensitive), where.title.contains (insensitive), and where.OR — an array of
 * sub-conditions each of which may be { genreNormalized: { contains } } or
 * { tagList: { contains, mode: 'insensitive' } }.
 */
function fakePrisma(likes) {
  const matchesSubclause = (row, clause) => {
    if (clause.genreNormalized?.contains !== undefined) {
      return (row.genreNormalized || '').includes(clause.genreNormalized.contains);
    }
    if (clause.tagList?.contains !== undefined) {
      const needle = clause.tagList.contains.toLowerCase();
      return (row.tagList || '').toLowerCase().includes(needle);
    }
    return false;
  };
  return {
    indexedLike: {
      findMany: async ({ where, take }) => {
        let rows = likes;
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        if (where?.artistName?.contains) {
          const q = where.artistName.contains.toLowerCase();
          rows = rows.filter((r) => (r.artistName || '').toLowerCase().includes(q));
        }
        if (where?.title?.contains) {
          const q = where.title.contains.toLowerCase();
          rows = rows.filter((r) => (r.title || '').toLowerCase().includes(q));
        }
        if (Array.isArray(where?.OR)) {
          rows = rows.filter((r) => where.OR.some((clause) => matchesSubclause(r, clause)));
        }
        return take ? rows.slice(0, take) : rows;
      },
    },
  };
}

const likes = [
  { userId: 'u1', trackId: 1, title: 'A', artistName: 'Riordan', genreNormalized: 'tech house', tagList: '' },
  { userId: 'u1', trackId: 2, title: 'B', artistName: 'Riordan', genreNormalized: 'house', tagList: '' },
  { userId: 'u1', trackId: 3, title: 'C', artistName: 'Other', genreNormalized: 'tech house', tagList: '' },
  { userId: 'u2', trackId: 4, title: 'D', artistName: 'Riordan', genreNormalized: 'tech house', tagList: '' },
  // Indexed under canonical "drum and bass" — query for "dnb" must find it.
  { userId: 'u1', trackId: 5, title: 'DNB track', artistName: 'Z', genreNormalized: 'drum and bass', tagList: '' },
  // Tagged only — no genre field — query for "Tech House" must still find it.
  { userId: 'u1', trackId: 6, title: 'Tagged only', artistName: 'Q', genreNormalized: null, tagList: 'tech house, dark warehouse' },
];

describe('library-index query readers', () => {
  test('searchLikes filters by artist within the user scope', async () => {
    const res = await searchLikes('u1', { artist: 'riordan' }, { prisma: fakePrisma(likes) });
    expect(res.map((r) => r.trackId).sort()).toEqual([1, 2]);
  });

  test('searchLikes filters by normalized genre and includes tag-only matches', async () => {
    const res = await searchLikes('u1', { genre: 'Tech House' }, { prisma: fakePrisma(likes) });
    expect(res.map((r) => r.trackId).sort()).toEqual([1, 3, 6]);
  });

  test('searchLikes finds alias matches (dnb -> drum and bass)', async () => {
    const res = await searchLikes('u1', { genre: 'dnb' }, { prisma: fakePrisma(likes) });
    expect(res.map((r) => r.trackId)).toEqual([5]);
  });

  test('countLikesByArtist returns count and sample', async () => {
    const res = await countLikesByArtist('u1', 'Riordan', { prisma: fakePrisma(likes) });
    expect(res.count).toBe(2);
    expect(res.sample.length).toBeLessThanOrEqual(5);
  });
});
