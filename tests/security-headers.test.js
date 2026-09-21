/**
 * The Content-Security-Policy is the enforcement behind a promise the privacy
 * policy makes in plain words: "We run no analytics or advertising scripts and
 * set no third-party cookies."
 *
 * These assertions fail the moment somebody re-adds an analytics tag, a widget
 * CDN or an external font host to the policy, which is the only way such a
 * script could load at all.
 */

const { cspDirectives, securityHeaders } = await import('../server/middleware/security.js');

/** Hosts that have been in this CSP before, or would be if tracking came back. */
const FORBIDDEN_HOSTS = [
  'buymeacoffee',
  'googletagmanager',
  'google-analytics',
  'vercel',
  'googleapis',
  'gstatic',
];

describe('Content-Security-Policy directives', () => {
  test('scriptSrc allows nothing but our own origin and inline bootstrap', () => {
    // 'unsafe-inline' stays: Next.js's static export inlines its bootstrap.
    expect(cspDirectives.scriptSrc).toEqual(["'self'", "'unsafe-inline'"]);
  });

  test.each(['scriptSrc', 'styleSrc', 'connectSrc', 'fontSrc'])(
    '%s names no tracking, widget or external-font host',
    (directive) => {
      const sources = cspDirectives[directive];
      expect(Array.isArray(sources)).toBe(true);
      for (const source of sources) {
        for (const host of FORBIDDEN_HOSTS) {
          expect(source).not.toContain(host);
        }
      }
    },
  );

  test('styleSrc and fontSrc load from our own origin only', () => {
    // next/font self-hosts the webfonts into the static export, so neither
    // fonts.googleapis.com nor fonts.gstatic.com is ever contacted.
    expect(cspDirectives.styleSrc).toEqual(["'self'", "'unsafe-inline'"]);
    expect(cspDirectives.fontSrc).toEqual(["'self'", 'data:']);
  });

  test('connectSrc names SoundCloud and localhost as its only hosts', () => {
    // Scheme-only sources like `wss:` name no host; everything with a `//`
    // authority does, and each one has to be SoundCloud or local dev.
    const hosts = cspDirectives.connectSrc.filter((source) => source.includes('//'));
    expect(hosts.length).toBeGreaterThan(0);
    for (const source of hosts) {
      expect(source).toMatch(/soundcloud\.com|localhost/);
    }
  });

  test('securityHeaders is still wired up as middleware', () => {
    expect(typeof securityHeaders).toBe('function');
  });
});
