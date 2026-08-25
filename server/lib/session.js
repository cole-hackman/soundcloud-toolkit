import crypto from 'crypto';

/** Session lifetime. Also the cookie maxAge; enforced INSIDE the signed
 * payload via iat so a stolen cookie cannot outlive it. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sign a session cookie value
 * @param value The value to sign
 * @param secret The signing secret
 * @returns Signed cookie value
 */
export function signSession(value, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64url');
  
  return `${value}.${signature}`;
}

/**
 * Verify and unsign a session cookie value
 * @param signedValue The signed cookie value
 * @param secret The signing secret
 * @returns The original value if valid, null if invalid
 */
export function unsignSession(signedValue, secret) {
  // Split on the LAST '.' to avoid breaking when value contains '.' (e.g. URLs)
  const lastDotIndex = signedValue.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === signedValue.length - 1) {
    return null;
  }
  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64url');

  const providedBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  return value;
}

/**
 * Parse session data from JSON string
 * @param sessionJson JSON string containing session data
 * @returns Parsed session data or null if invalid
 */
export function parseSessionData(sessionJson) {
  try {
    const data = JSON.parse(sessionJson);
    if (!data || typeof data !== 'object') return null;
    // Sessions signed before iat existed (pre-hardening) are treated as
    // expired: users re-authenticate once after this deploys.
    if (typeof data.iat !== 'number' || Date.now() - data.iat > SESSION_TTL_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Create session cookie options
 * @param maxAge Maximum age in milliseconds
 * @returns Cookie options object
 */
export function createSessionCookieOptions(maxAge = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge,
    path: '/'
  };
}
