import crypto from 'crypto';

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

  if (signature !== expectedSignature) {
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
    return JSON.parse(sessionJson);
  } catch {
    return null;
  }
}

/**
 * Create session cookie options
 * @param maxAge Maximum age in milliseconds
 * @returns Cookie options object
 */
export function createSessionCookieOptions(maxAge = 7 * 24 * 60 * 60 * 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge,
    path: '/'
  };
}
