import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const findMany = jest.fn().mockResolvedValue([]);
const count = jest.fn().mockResolvedValue(0);
const groupBy = jest.fn().mockResolvedValue([]);
const update = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { feedback: { findMany, count, groupBy, update } },
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  authenticateUser: function authenticateUser(req, res, next) {
    req.user = { id: 'user-a', soundcloudId: 111 };
    next();
  },
}));
jest.unstable_mockModule('../../server/lib/logger.js', () => ({
  default: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { default: adminRoutes } = await import('../../server/routes/admin.js');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

const ORIGINAL_ADMIN_IDS = process.env.ADMIN_IDS;
afterEach(() => {
  if (ORIGINAL_ADMIN_IDS === undefined) delete process.env.ADMIN_IDS;
  else process.env.ADMIN_IDS = ORIGINAL_ADMIN_IDS;
});

beforeEach(() => {
  findMany.mockClear().mockResolvedValue([]);
  count.mockClear().mockResolvedValue(0);
  groupBy.mockClear().mockResolvedValue([]);
  update.mockClear();
  // The mocked session user is soundcloudId 111; this makes them an admin.
  process.env.ADMIN_IDS = '111';
});

describe('the feedback inbox is admin-only', () => {
  test.each([
    ['get', '/api/admin/feedback-items'],
    ['get', '/api/admin/feedback-items/summary'],
    ['get', '/api/admin/feedback-items.csv'],
  ])('%s %s is 403 when ADMIN_IDS is unset', async (method, path) => {
    delete process.env.ADMIN_IDS;

    const res = await request(app)[method](path);

    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  test('PATCH is 403 when ADMIN_IDS is unset', async () => {
    delete process.env.ADMIN_IDS;

    const res = await request(app)
      .patch('/api/admin/feedback-items/fb-1')
      .send({ status: 'done' });

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  test('an authenticated non-admin is refused', async () => {
    process.env.ADMIN_IDS = '999';

    const res = await request(app).get('/api/admin/feedback-items');

    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/feedback-items', () => {
  test('applies the status filter', async () => {
    const res = await request(app).get('/api/admin/feedback-items?status=new');

    expect(res.status).toBe(200);
    expect(findMany.mock.calls[0][0].where).toEqual({ status: 'new' });
    // The count must use the same filter, or `total` describes a different set
    // than the page it is paginating.
    expect(count.mock.calls[0][0].where).toEqual({ status: 'new' });
  });

  test('applies the type filter alongside status', async () => {
    await request(app).get('/api/admin/feedback-items?status=seen&type=bug');

    expect(findMany.mock.calls[0][0].where).toEqual({ status: 'seen', type: 'bug' });
  });

  test('drops an unrecognised status instead of passing it through', async () => {
    await request(app).get('/api/admin/feedback-items?status=archived');

    // A typo returns everything rather than nothing, and no arbitrary string
    // reaches the query.
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });

  test('caps pageSize at 200', async () => {
    const res = await request(app).get('/api/admin/feedback-items?pageSize=5000');

    expect(res.status).toBe(200);
    expect(findMany.mock.calls[0][0].take).toBe(200);
    expect(res.body.pageSize).toBe(200);
  });

  test('defaults to 50 per page and page 1', async () => {
    const res = await request(app).get('/api/admin/feedback-items');

    expect(findMany.mock.calls[0][0].take).toBe(50);
    expect(findMany.mock.calls[0][0].skip).toBe(0);
    expect(res.body.page).toBe(1);
  });

  test('page 3 skips the first two pages', async () => {
    await request(app).get('/api/admin/feedback-items?page=3&pageSize=25');

    expect(findMany.mock.calls[0][0].skip).toBe(50);
    expect(findMany.mock.calls[0][0].take).toBe(25);
  });

  test('a page below 1 is clamped rather than producing a negative skip', async () => {
    await request(app).get('/api/admin/feedback-items?page=-4');

    expect(findMany.mock.calls[0][0].skip).toBe(0);
  });

  test('returns rows newest first with the sender attached', async () => {
    findMany.mockResolvedValue([{
      id: 'fb-1',
      type: 'bug',
      message: 'It broke.',
      page: '/combine',
      email: null,
      status: 'new',
      adminNote: null,
      clientInfo: { device: 'desktop' },
      soundcloudId: 111,
      createdAt: new Date('2026-09-22T00:00:00Z'),
      user: { username: 'cole', displayName: 'Cole', avatarUrl: null },
    }]);
    count.mockResolvedValue(1);

    const res = await request(app).get('/api/admin/feedback-items');

    expect(findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      id: 'fb-1',
      type: 'bug',
      message: 'It broke.',
      soundcloudId: 111,
      user: { username: 'cole', displayName: 'Cole', avatarUrl: null },
    });
  });
});

describe('GET /api/admin/feedback-items/summary', () => {
  test('reports every bucket, including the empty ones', async () => {
    count
      .mockResolvedValueOnce(7)   // total
      .mockResolvedValueOnce(3);  // unread
    groupBy
      .mockResolvedValueOnce([
        { status: 'new', _count: { id: 3 } },
        { status: 'done', _count: { id: 4 } },
      ])
      .mockResolvedValueOnce([{ type: 'bug', _count: { id: 7 } }]);

    const res = await request(app).get('/api/admin/feedback-items/summary');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(7);
    expect(res.body.unread).toBe(3);
    // Seeded at zero so the client renders a stable set of buckets rather than
    // hiding the ones that are empty today.
    expect(res.body.byStatus).toEqual({ new: 3, seen: 0, done: 4, spam: 0 });
    expect(res.body.byType).toEqual({ bug: 7, feature: 0, other: 0 });
  });

  test('unread counts the "new" status specifically', async () => {
    await request(app).get('/api/admin/feedback-items/summary');

    expect(count).toHaveBeenNthCalledWith(2, { where: { status: 'new' } });
  });
});

describe('PATCH /api/admin/feedback-items/:id', () => {
  beforeEach(() => {
    update.mockResolvedValue({
      id: 'fb-1', type: 'bug', page: '/combine', status: 'done',
      adminNote: null, createdAt: new Date(), updatedAt: new Date(),
    });
  });

  test('accepts a known status', async () => {
    const res = await request(app)
      .patch('/api/admin/feedback-items/fb-1')
      .send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: 'fb-1' },
      data: { status: 'done' },
    });
  });

  test('rejects an unknown status and writes nothing', async () => {
    const res = await request(app)
      .patch('/api/admin/feedback-items/fb-1')
      .send({ status: 'archived' });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  test('rejects an admin note over 2000 characters', async () => {
    const res = await request(app)
      .patch('/api/admin/feedback-items/fb-1')
      .send({ adminNote: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  test('writes only status and adminNote, never user content', async () => {
    await request(app)
      .patch('/api/admin/feedback-items/fb-1')
      .send({ status: 'seen', adminNote: 'Looked at it.', message: 'rewritten', email: 'x@y.co' });

    const { data } = update.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual(['adminNote', 'status']);
    expect(data.message).toBeUndefined();
    expect(data.email).toBeUndefined();
  });

  test('an explicit null clears the admin note', async () => {
    await request(app)
      .patch('/api/admin/feedback-items/fb-1')
      .send({ adminNote: null });

    expect(update.mock.calls[0][0].data).toEqual({ adminNote: null });
  });

  test('an empty patch is refused rather than bumping updatedAt for nothing', async () => {
    const res = await request(app).patch('/api/admin/feedback-items/fb-1').send({});

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  test('a missing row is a 404, not a 500', async () => {
    const notFound = new Error('not found');
    notFound.code = 'P2025';
    update.mockRejectedValue(notFound);

    const res = await request(app)
      .patch('/api/admin/feedback-items/fb-gone')
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/feedback-items.csv', () => {
  test('serves a CSV attachment with a BOM and the documented columns', async () => {
    findMany.mockResolvedValue([{
      id: 'fb-1',
      createdAt: new Date('2026-09-22T00:00:00Z'),
      type: 'bug',
      status: 'new',
      soundcloudId: 111,
      page: '/combine',
      email: null,
      message: 'It broke.',
      adminNote: null,
      user: { username: 'cole' },
    }]);

    const res = await request(app).get('/api/admin/feedback-items.csv?status=new');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.charCodeAt(0)).toBe(0xfeff); // BOM, so Excel reads UTF-8
    const [header, first] = res.text.replace('﻿', '').split('\n');
    expect(header).toBe(
      'id,createdAt,type,status,username,soundcloudId,page,email,message,adminNote'
    );
    expect(first).toContain('fb-1');
    expect(first).toContain('cole');
    expect(findMany.mock.calls[0][0].where).toEqual({ status: 'new' });
  });

  test('quotes a message containing commas, quotes and newlines', async () => {
    findMany.mockResolvedValue([{
      id: 'fb-2',
      createdAt: new Date('2026-09-22T00:00:00Z'),
      type: 'other',
      status: 'new',
      soundcloudId: 111,
      page: null,
      email: null,
      message: 'one, two\nthree "quoted"',
      adminNote: null,
      user: { username: 'cole' },
    }]);

    const res = await request(app).get('/api/admin/feedback-items.csv');

    // The separator and the row break must not leak out of the field, or one
    // report silently becomes two rows.
    expect(res.text).toContain('"one, two\nthree ""quoted"""');
  });
});
