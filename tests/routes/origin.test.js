import express from 'express';
import request from 'supertest';

const { rejectUntrustedOrigin } = await import('../../server/middleware/security.js');

const app = express();
app.use(rejectUntrustedOrigin);
app.post('/api/x', (req, res) => res.json({ ok: true }));
app.get('/api/x', (req, res) => res.json({ ok: true }));

const ORIGINAL = process.env.APP_URLS;
beforeEach(() => { process.env.APP_URLS = 'https://www.soundcloudtoolkit.com'; });
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.APP_URLS;
  else process.env.APP_URLS = ORIGINAL;
});

describe('rejectUntrustedOrigin', () => {
  test('allows state-changing requests with no Origin header (same-origin, curl)', async () => {
    expect((await request(app).post('/api/x')).status).toBe(200);
  });

  test('allows allowlisted origins', async () => {
    const res = await request(app).post('/api/x').set('Origin', 'https://www.soundcloudtoolkit.com');
    expect(res.status).toBe(200);
  });

  test('allows localhost origins (dev)', async () => {
    const res = await request(app).post('/api/x').set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(200);
  });

  test('rejects untrusted origins on POST with 403', async () => {
    const res = await request(app).post('/api/x').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
  });

  test('does not block GET requests regardless of Origin', async () => {
    const res = await request(app).get('/api/x').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(200);
  });
});
