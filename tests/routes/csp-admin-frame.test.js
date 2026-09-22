import express from 'express';
import request from 'supertest';
import { securityHeaders, ADMIN_FRAME_SRC, isAdminPagePath } from '../../server/middleware/security.js';

// The admin console embeds SoundCloud's player widget, which needs
// `frame-src https://w.soundcloud.com`. That allowance must apply to the
// /admin document only: every other page, and the API, keeps `frame-src
// 'none'`.

const app = express();
app.use(securityHeaders);
app.get('*', (req, res) => res.send('ok'));

function frameSrc(res) {
  const csp = res.headers['content-security-policy'] || '';
  const directive = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-src'));
  return directive ? directive.replace(/^frame-src\s*/, '') : null;
}

describe('CSP frame-src is opened for the admin console only', () => {
  test('/admin and /admin/ may frame the SoundCloud player', async () => {
    // The expectation is the literal origin, not `ADMIN_FRAME_SRC`. Comparing
    // the header to the constant that produced it is a tautology: point the
    // constant at a tracker and this test still goes green. The constant is
    // still asserted — against its own value — in tests/security-headers.js,
    // beside the FORBIDDEN_HOSTS sweep that now covers frame-src too.
    expect(ADMIN_FRAME_SRC).toBe('https://w.soundcloud.com');
    for (const path of ['/admin', '/admin/', '/admin/index.html']) {
      const res = await request(app).get(path);
      expect(frameSrc(res)).toBe('https://w.soundcloud.com');
    }
  });

  test('every other page keeps frame-src none', async () => {
    for (const path of ['/', '/dashboard/', '/combine/', '/administer/', '/api/admin/stats', '/api/auth/me']) {
      const res = await request(app).get(path);
      expect(frameSrc(res)).toBe("'none'");
    }
  });

  test('the rest of the policy is identical on both branches', async () => {
    const strip = (csp) => csp.split(';').map((d) => d.trim()).filter((d) => !d.startsWith('frame-src')).sort();
    const admin = await request(app).get('/admin/');
    const home = await request(app).get('/');
    expect(strip(admin.headers['content-security-policy'])).toEqual(strip(home.headers['content-security-policy']));
    expect(admin.headers['content-security-policy']).toBeTruthy();
  });

  test('isAdminPagePath matches the document path, not prefixes of other words', () => {
    expect(isAdminPagePath('/admin')).toBe(true);
    expect(isAdminPagePath('/admin/')).toBe(true);
    expect(isAdminPagePath('/administer')).toBe(false);
    expect(isAdminPagePath('/api/admin/stats')).toBe(false);
  });
});
