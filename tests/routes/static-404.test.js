import express from 'express';
import request from 'supertest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { mountStaticSite } from '../../server/lib/static-site.js';

let buildPath;
let app;

beforeAll(() => {
  buildPath = mkdtempSync(join(tmpdir(), 'static-site-test-'));
  writeFileSync(join(buildPath, 'index.html'), '<html><body>home</body></html>');
  mkdirSync(join(buildPath, 'about'));
  writeFileSync(join(buildPath, 'about', 'index.html'), '<html><body>about page</body></html>');
  writeFileSync(join(buildPath, '404.html'), '<html><body>not found</body></html>');

  app = express();
  mountStaticSite(app, buildPath, {
    aliases: {
      '/sc-toolkit': '/faq/#rebrand',
      '/soundcloud-toolkit': '/faq/#rebrand',
      '/rebrand': '/faq/#rebrand',
    },
  });
  // Registered after mountStaticSite, like server/index.js's real 404 API
  // handler and /health route — proves the static middleware passes these
  // through instead of swallowing them.
  app.get('/api/x', (req, res) => res.json({ ok: true }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
});

afterAll(() => {
  rmSync(buildPath, { recursive: true, force: true });
});

describe('mountStaticSite', () => {
  test('serves a route directory\'s index.html with 200', async () => {
    const res = await request(app).get('/about/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('about page');
  });

  test('serves out/404.html with a real 404 status for an unknown path', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.text).toContain('not found');
  });

  test('301s /sc-toolkit to /faq/#rebrand', async () => {
    const res = await request(app).get('/sc-toolkit');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/faq/#rebrand');
  });

  test('301s /sc-toolkit/ (trailing slash normalized) to /faq/#rebrand', async () => {
    const res = await request(app).get('/sc-toolkit/');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/faq/#rebrand');
  });

  test('leaves /api/* paths to a handler mounted after it', async () => {
    const res = await request(app).get('/api/x');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('leaves /health untouched', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
