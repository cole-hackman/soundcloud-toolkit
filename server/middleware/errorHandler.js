import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { SUPPORT_EMAIL } from '../lib/support.js';

/**
 * Express global error-handling middleware.
 *
 * Extracted from index.js so it can be mounted on a bare app in tests
 * (tests/routes/error-handler.test.js) without booting the real server.
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error('Unhandled error:', safeError(err));

  // Sanitize error message to prevent information leakage
  let errorMessage = 'Something went wrong';
  if (process.env.NODE_ENV === 'development') {
    // In development, show error but sanitize secrets
    const msg = String(err.message || '');
    // Remove potential secrets from error messages
    errorMessage = msg
      .replace(/client_secret[=:]\S+/gi, 'client_secret=***')
      .replace(/secret[=:]\S+/gi, 'secret=***')
      .replace(/token[=:]\S+/gi, 'token=***')
      .replace(/key[=:]\S+/gi, 'key=***')
      .replace(/password[=:]\S+/gi, 'password=***');
  }

  const status = err.status || 500;
  const body = {
    error: 'Internal server error',
    message: errorMessage,
  };
  // Only server errors get the support pointer — a 4xx is something the
  // client can usually fix on its own.
  if (status >= 500) {
    body.support = SUPPORT_EMAIL;
  }

  res.status(status).json(body);
}

export default errorHandler;
