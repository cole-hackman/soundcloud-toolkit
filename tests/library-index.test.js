import { searchLikes, countLikesByArtist } from '../server/lib/library-index.js';

function fakePrisma(likes) {
  return {
    indexedLike: {
      findMany: async ({ where, take }) => {
        let rows = likes;
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        if (where?.artistName?.contains) {
          const q = where.artistName.contains.toLowerCase();
          rows = rows.filter((r) => (r.artistName || '').toLowerCase().includes(q));
        }
        if (where?.genreNormalized?.contains) {
          const q = where.genreNormalized.contains;
          rows = rows.filter((r) => (r.genreNormalized || '').includes(q));
        }
        return take ? rows.slice(0, take) : rows;
      },
    },
  };
}

const likes = [
  { userId: 'u1', trackId: 1, title: 'A', artistName: 'Riordan', genreNormalized: 'tech house' },
  { userId: 'u1', trackId: 2, title: 'B', artistName: 'Riordan', genreNormalized: 'house' },
  { userId: 'u1', trackId: 3, title: 'C', artistName: 'Other', genreNormalized: 'tech house' },
  { userId: 'u2', trackId: 4, title: 'D', artistName: 'Riordan', genreNormalized: 'tech house' },
];

describe('library-index query readers', () => {
  test('searchLikes filters by artist within the user scope', async () => {
    const res = await searchLikes('u1', { artist: 'riordan' }, { prisma: fakePrisma(likes) });
    expect(res.map((r) => r.trackId).sort()).toEqual([1, 2]);
  });

  test('searchLikes filters by normalized genre', async () => {
    const res = await searchLikes('u1', { genre: 'Tech House' }, { prisma: fakePrisma(likes) });
    expect(res.map((r) => r.trackId).sort()).toEqual([1, 3]);
  });

  test('countLikesByArtist returns count and sample', async () => {
    const res = await countLikesByArtist('u1', 'Riordan', { prisma: fakePrisma(likes) });
    expect(res.count).toBe(2);
    expect(res.sample.length).toBeLessThanOrEqual(5);
  });
});
