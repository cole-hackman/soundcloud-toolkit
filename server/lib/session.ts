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
  const [value, signature] = signedValue.split('.');
  
  if (!value || !signature) {
    return null;
  }

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
    sameSite: 'lax',
    maxAge,
    path: '/'
  };
}
