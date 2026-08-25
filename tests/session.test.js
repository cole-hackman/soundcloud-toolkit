const SECRET = 'test-secret-that-is-at-least-32-chars!!';
const { signSession, unsignSession, parseSessionData, SESSION_TTL_MS } =
  await import('../server/lib/session.js');

describe('signSession / unsignSession', () => {
  test('round-trips a value containing dots', () => {
    const value = JSON.stringify({ userId: 'a.b.c', url: 'https://x.com/y' });
    expect(unsignSession(signSession(value, SECRET), SECRET)).toBe(value);
  });

  test('rejects a tampered signature', () => {
    const signed = signSession('payload', SECRET);
    const lastDot = signed.lastIndexOf('.');
    const tampered = signed.slice(0, lastDot + 1) + 'AAAA' + signed.slice(lastDot + 5);
    expect(unsignSession(tampered, SECRET)).toBeNull();
  });

  test('rejects a signature of the wrong length (timingSafeEqual guard)', () => {
    expect(unsignSession('payload.short', SECRET)).toBeNull();
  });
});

describe('parseSessionData expiry', () => {
  test('SESSION_TTL_MS is 7 days', () => {
    expect(SESSION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('accepts a fresh payload with iat', () => {
    const json = JSON.stringify({ userId: 'u1', iat: Date.now() });
    expect(parseSessionData(json)).toMatchObject({ userId: 'u1' });
  });

  test('rejects a payload without iat (legacy cookie)', () => {
    expect(parseSessionData(JSON.stringify({ userId: 'u1' }))).toBeNull();
  });

  test('rejects a payload older than the TTL', () => {
    const json = JSON.stringify({ userId: 'u1', iat: Date.now() - SESSION_TTL_MS - 1000 });
    expect(parseSessionData(json)).toBeNull();
  });

  test('rejects malformed JSON', () => {
    expect(parseSessionData('not json')).toBeNull();
  });
});
