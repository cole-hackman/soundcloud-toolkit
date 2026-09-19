import express from 'express';
import request from 'supertest';

const { legacyHostRedirect } = await import('../../server/middleware/legacy-redirect.js');

const app = express();
app.use(legacyHostRedirect);
app.get('/health', (req, res) => res.json({ ok: true }));
app.post('/api/x', (req, res) => res.json({ ok: true }));

const ORIGINAL = { hosts: process.env.LEGACY_REDIRECT_HOSTS, url: process.env.APP_URL };
beforeEach(() => {
  process.env.LEGACY_REDIRECT_HOSTS = 'www.tracktoolkit.com,soundcloudtoolkit.com,api.soundcloudtoolkit.com';
  process.env.APP_URL = 'https://tracktoolkit.com';
});
afterAll(() => {
  if (ORIGINAL.hosts === undefined) delete process.env.LEGACY_REDIRECT_HOSTS;
  else process.env.LEGACY_REDIRECT_HOSTS = ORIGINAL.hosts;
  if (ORIGINAL.url === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = ORIGINAL.url;
});

describe('legacyHostRedirect', () => {
  test('is a no-op when LEGACY_REDIRECT_HOSTS is unset', async () => {
    delete process.env.LEGACY_REDIRECT_HOSTS;
    const res = await request(app).get('/health').set('Host', 'api.soundcloudtoolkit.com');
    expect(res.status).toBe(200);
  });

  test('301s GET on a listed host, preserving path and query', async () => {
    const res = await request(app).get('/about/?ref=x').set('Host', 'soundcloudtoolkit.com');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://tracktoolkit.com/about/?ref=x');
  });

  test('308s non-GET so stale API clients keep their method', async () => {
    const res = await request(app).post('/api/x').set('Host', 'api.soundcloudtoolkit.com');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://tracktoolkit.com/api/x');
  });

  test('never redirects the canonical host or an unlisted host', async () => {
    expect((await request(app).get('/health').set('Host', 'tracktoolkit.com')).status).toBe(200);
    expect((await request(app).get('/health').set('Host', 'tracktoolkit.azurewebsites.net')).status).toBe(200);
  });

  test('matches hosts case-insensitively', async () => {
    const res = await request(app).get('/').set('Host', 'WWW.TrackToolkit.com');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://tracktoolkit.com/');
  });
});
