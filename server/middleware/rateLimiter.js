import rateLimit from 'express-rate-limit';

/**
 * In development, bypass all rate limiters so rapid iteration isn't throttled.
 * Production behavior is completely unchanged.
 */
const isDev = process.env.NODE_ENV === 'development';
const createLimiter = (options) => {
  if (isDev) {
    return (req, res, next) => next();
  }
  return rateLimit(options);
};

/**
 * General API rate limiter - applies to all API routes
 * Allows 600 requests per 15 minutes per IP
 *
 * Raised from 100. Progressive loading pages a library 200 items at a time,
 * so a user with 20,000 likes spends 100 requests browsing ONE tool — the old
 * ceiling was a quarter of that and would have cut them off mid-scroll. This
 * limiter is also per-IP, so anyone behind shared NAT divides it further.
 * The heavy-operation limiter (20/hour) still guards the expensive writes,
 * which is where abuse actually costs something.
 *
 * Uses default keyGenerator which handles IPv6 correctly when Express trust proxy is configured
 */
export const apiRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // Limit each IP to 600 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Default keyGenerator handles IPv6 correctly when Express is configured with trust proxy
});

/**
 * Stricter rate limiter for authentication endpoints
 * Allows 5 login attempts per 15 minutes per IP
 */
export const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  // Default keyGenerator handles IPv6 correctly
});

/**
 * Rate limiter for resource-intensive endpoints (merge, resolve, etc.)
 * Allows 20 requests per hour per IP
 */
export const heavyOperationRateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 heavy operations per hour
  message: {
    error: 'Too many resource-intensive requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Default keyGenerator handles IPv6 correctly
});

/**
 * Rate limiter for the bounded paged library reads — the library audit and the
 * playlist keyword search. Allows 60 requests per hour per IP.
 *
 * These two are reads, and their cost is bounded: one page is at most 50
 * playlist fetches, against a cached playlist list. They were sharing the
 * 20/hour heavy budget with merge, clone, and every bulk write, which meant
 * paging through a 400-playlist library twenty pages at a time locked the user
 * out of the operations that actually mutate their account — and did it after
 * twenty page views, which is one sitting. Sitting between heavy and general
 * gives the page walk room without handing a write budget away.
 */
export const libraryReadRateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // Limit each IP to 60 paged library reads per hour
  message: {
    error: 'Too many library scans, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Default keyGenerator handles IPv6 correctly
});

/**
 * Light rate limiter for health check endpoint
 * Allows 60 requests per minute per IP (prevents abuse while allowing monitoring)
 */
export const healthCheckRateLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 health checks per minute
  message: {
    error: 'Too many health check requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful health checks
});

