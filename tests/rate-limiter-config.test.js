import { jest } from '@jest/globals';

// Capture the original NODE_ENV so we can restore it after the test.
// This is critical: rateLimiter.js captures isDev at module load, and Jest
// reuses the process across test files. If we don't restore, later tests will
// see production rate limiters and fail with intermittent 429 flakes.
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

// Production mode, or createLimiter() returns bare pass-throughs.
process.env.NODE_ENV = 'production';

const rateLimit = jest.fn((options) => {
  const mw = (req, res, next) => next();
  mw.options = options;
  return mw;
});
jest.unstable_mockModule('express-rate-limit', () => ({ default: rateLimit }));

const limiters = await import('../server/middleware/rateLimiter.js');

const MINUTE = 60 * 1000;

describe('rate limiter tiers are configured as documented', () => {
  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  test('general API: 600 requests / 15 minutes', () => {
    // Sized for progressive loading: paging a large library at 200 items per
    // request costs ~100 requests for one tool, and the old ceiling of 100
    // would have cut a heavy user off mid-scroll.
    expect(limiters.apiRateLimiter.options).toMatchObject({
      windowMs: 15 * MINUTE, max: 600, standardHeaders: true, legacyHeaders: false,
    });
  });

  test('auth: 5 attempts / 15 minutes, successful requests not counted', () => {
    expect(limiters.authRateLimiter.options).toMatchObject({
      windowMs: 15 * MINUTE, max: 5, skipSuccessfulRequests: true,
    });
  });

  test('heavy operations: 20 / hour', () => {
    expect(limiters.heavyOperationRateLimiter.options).toMatchObject({
      windowMs: 60 * MINUTE, max: 20,
    });
  });

  test('paged library reads: 60 / hour', () => {
    // Bounded reads (<= 50 SoundCloud calls each) that used to spend the
    // heavy budget shared with merge, clone and every bulk write.
    expect(limiters.libraryReadRateLimiter.options).toMatchObject({
      windowMs: 60 * MINUTE, max: 60, standardHeaders: true, legacyHeaders: false,
    });
  });

  test('health check: 60 / minute', () => {
    expect(limiters.healthCheckRateLimiter.options).toMatchObject({
      windowMs: MINUTE, max: 60,
    });
  });

  test('every limiter is strictly stricter than the tier above it where it matters', () => {
    expect(limiters.authRateLimiter.options.max)
      .toBeLessThan(limiters.apiRateLimiter.options.max);
    expect(limiters.heavyOperationRateLimiter.options.max)
      .toBeLessThan(limiters.apiRateLimiter.options.max);
    // The paged reads sit between the two: looser than the write budget they
    // used to consume, still far tighter than general API traffic.
    expect(limiters.heavyOperationRateLimiter.options.max)
      .toBeLessThan(limiters.libraryReadRateLimiter.options.max);
    expect(limiters.libraryReadRateLimiter.options.max)
      .toBeLessThan(limiters.apiRateLimiter.options.max);
  });

  test('no per-IP limiter defines a custom keyGenerator (default handles IPv6 correctly)', () => {
    for (const name of ['apiRateLimiter', 'authRateLimiter', 'heavyOperationRateLimiter', 'libraryReadRateLimiter', 'healthCheckRateLimiter']) {
      expect(limiters[name].options.keyGenerator).toBeUndefined();
    }
  });
});

describe('per-user limiters key on the account, not the address', () => {
  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  test('feedback hourly: 5 / hour', () => {
    expect(limiters.feedbackHourlyLimiter.options).toMatchObject({
      windowMs: 60 * MINUTE, max: 5, standardHeaders: true, legacyHeaders: false,
    });
  });

  test('feedback daily: 20 / 24 hours', () => {
    // The hourly window alone would permit 120 submissions a day; this is the
    // ceiling that actually bounds the inbox.
    expect(limiters.feedbackDailyLimiter.options).toMatchObject({
      windowMs: 24 * 60 * MINUTE, max: 20, standardHeaders: true, legacyHeaders: false,
    });
  });

  test('the daily budget is larger than one hour of the hourly budget', () => {
    // Otherwise the hourly limiter would be dead code.
    expect(limiters.feedbackDailyLimiter.options.max)
      .toBeGreaterThan(limiters.feedbackHourlyLimiter.options.max);
  });

  test('both key on req.user.id, falling back to req.ip', () => {
    for (const name of ['feedbackHourlyLimiter', 'feedbackDailyLimiter']) {
      const { keyGenerator } = limiters[name].options;
      expect(typeof keyGenerator).toBe('function');
      expect(keyGenerator({ user: { id: 'user-a' }, ip: '203.0.113.9' })).toBe('user-a');
      // Unauthenticated is unreachable on the routes these are mounted on —
      // they always sit behind authenticateUser — but the key must never come
      // back undefined, which would bucket every such request together.
      expect(keyGenerator({ ip: '203.0.113.9' })).toBe('203.0.113.9');
    }
  });

  test('both disable the IP-fallback validation that would log at startup', () => {
    // express-rate-limit v8 flags a custom keyGenerator that reads req.ip
    // without the ipKeyGenerator helper. It logs ERR_ERL_KEY_GEN_IPV6 on every
    // module load rather than throwing, so the flag is what keeps startup
    // output clean — and makes the trade-off deliberate rather than ignored.
    for (const name of ['feedbackHourlyLimiter', 'feedbackDailyLimiter']) {
      expect(limiters[name].options.validate).toEqual({ keyGeneratorIpFallback: false });
    }
  });

  test('createUserLimiter wraps the message in the app-wide error shape', () => {
    const limiter = limiters.createUserLimiter({
      windowMs: 1000, max: 1, message: 'Slow down.',
    });
    expect(limiter.options.message).toEqual({ error: 'Slow down.' });
  });
});
