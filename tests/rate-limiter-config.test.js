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

  test('general API: 100 requests / 15 minutes', () => {
    expect(limiters.apiRateLimiter.options).toMatchObject({
      windowMs: 15 * MINUTE, max: 100, standardHeaders: true, legacyHeaders: false,
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
  });

  test('no limiter defines a custom keyGenerator (default handles IPv6 correctly)', () => {
    for (const name of ['apiRateLimiter', 'authRateLimiter', 'heavyOperationRateLimiter', 'healthCheckRateLimiter']) {
      expect(limiters[name].options.keyGenerator).toBeUndefined();
    }
  });
});
