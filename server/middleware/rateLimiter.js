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
 * Allows 100 requests per 15 minutes per IP
 * Uses default keyGenerator which handles IPv6 correctly when Express trust proxy is configured
 */
export const apiRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

