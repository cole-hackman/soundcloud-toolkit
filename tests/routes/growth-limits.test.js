import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
process.env.NODE_ENV = 'development'; // disables rate limiters

const count = jest.fn().mockResolvedValue(0);
const findFirst = jest.fn().mockResolvedValue(null);

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { growthAction: { count, findFirst } },
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 'user-a', soundcloudId: 111 };
    req.accessToken = 'at';
    req.refreshToken = 'rt';
    next();
  },
}));

const { default: growthRoutes } = await import('../../server/routes/growth.js');
const { GROWTH_DAILY_FOLLOW_CAP, GROWTH_SESSION_COOLDOWN_MS } =
  await import('../../server/lib/growth-engine.js');

const app = express();
app.use(express.json());
app.use('/api', growthRoutes);

function targets(n) {
  return Array.from({ length: n }, (_, i) => ({ userId: 1000 + i }));
}

afterAll(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

beforeEach(() => {
  count.mockReset();
  findFirst.mockReset();
  count.mockResolvedValue(0);
  findFirst.mockResolvedValue(null);
});

describe('follow caps are enforced server-side regardless of what the client asks for', () => {
  test('a user at the daily cap is refused with 429', async () => {
    // Mock: count returns the daily cap; findFirst returns null (no recent actions).
    // This means: user has used up all 50 follows in the last 24h.
    count.mockResolvedValue(GROWTH_DAILY_FOLLOW_CAP);
    findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/growth/engage').send({ targets: targets(1) });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/daily follow limit/i);
  });

  test('a user inside the session cooldown is refused with 429', async () => {
    // Mock: count returns 0 (no recent follows); findFirst returns a recent action
    // (less than 30 min ago). This triggers the cooldown check.
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - (GROWTH_SESSION_COOLDOWN_MS / 2)),
      sessionId: 'sess_123',
    });

    const res = await request(app).post('/api/growth/engage').send({ targets: targets(1) });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/cooldown/i);
  });

  test('requesting more targets than the remaining budget is refused with 400', async () => {
    // Mock: count returns 48 (2 follows left in daily budget); findFirst returns
    // an old action (outside cooldown, so no cooldown block). Trying to start
    // 10 follows when only 2 remain should fail with 400.
    count.mockResolvedValue(GROWTH_DAILY_FOLLOW_CAP - 2);
    findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - GROWTH_SESSION_COOLDOWN_MS - 60 * 1000),
      sessionId: 'sess_old',
    });

    const res = await request(app).post('/api/growth/engage').send({ targets: targets(10) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/remaining in your daily budget/i);
  });

  test('GET /growth/limits reports the cap without mutating anything', async () => {
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/growth/limits');

    expect(res.status).toBe(200);
    expect(res.body.budget ?? res.body).toMatchObject({
      dailyCap: GROWTH_DAILY_FOLLOW_CAP,
    });
  });
});
