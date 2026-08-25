import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));

const { adminAuth } = await import('../../server/middleware/adminAuth.js');
const { default: adminRoutes } = await import('../../server/routes/admin.js');

function appWithUser(user) {
  const app = express();
  app.get(
    '/admin-only',
    (req, res, next) => { req.user = user; next(); },
    adminAuth,
    (req, res) => res.json({ ok: true })
  );
  return app;
}

const ORIGINAL_ADMIN_IDS = process.env.ADMIN_IDS;
afterEach(() => {
  if (ORIGINAL_ADMIN_IDS === undefined) delete process.env.ADMIN_IDS;
  else process.env.ADMIN_IDS = ORIGINAL_ADMIN_IDS;
});

describe('adminAuth fails closed', () => {
  test('403 when ADMIN_IDS is unset', async () => {
    delete process.env.ADMIN_IDS;
    const res = await request(appWithUser({ soundcloudId: 111 })).get('/admin-only');
    expect(res.status).toBe(403);
  });

  test('403 for an authenticated non-admin', async () => {
    process.env.ADMIN_IDS = '999';
    const res = await request(appWithUser({ soundcloudId: 111 })).get('/admin-only');
    expect(res.status).toBe(403);
  });

  test('403 when req.user is missing entirely', async () => {
    process.env.ADMIN_IDS = '999';
    const res = await request(appWithUser(undefined)).get('/admin-only');
    expect(res.status).toBe(403);
  });

  test('200 for a configured admin', async () => {
    process.env.ADMIN_IDS = '111';
    const res = await request(appWithUser({ soundcloudId: 111 })).get('/admin-only');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('admin router registration', () => {
  test('every admin route runs authenticateUser and adminAuth', () => {
    const routes = adminRoutes.stack.filter((layer) => layer.route);
    expect(routes.length).toBeGreaterThan(0);
    for (const layer of routes) {
      const names = layer.route.stack.map((s) => s.handle.name);
      expect(names).toContain('authenticateUser');
      expect(names).toContain('adminAuth');
    }
  });
});
