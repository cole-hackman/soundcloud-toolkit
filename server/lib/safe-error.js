/**
 * Sanitize error objects before logging.
 * Strips potentially sensitive data (request bodies, tokens, full stack traces)
 * while preserving enough context for debugging.
 */
export function safeError(err) {
  if (!err) return { message: 'Unknown error' };

  return {
    message: err.message || String(err),
    ...(err.code && { code: err.code }),
    ...(err.status && { status: err.status }),
    // Only include stack traces in non-production environments
    ...(process.env.NODE_ENV !== 'production' && err.stack && { stack: err.stack })
  };
}
