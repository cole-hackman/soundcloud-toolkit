import crypto from 'crypto';

/**
 * Generate a PKCE code verifier and challenge pair
 * @returns Object containing codeVerifier and codeChallenge
 */
export function createPkcePair() {
  // Generate a random code verifier (43-128 characters)
  const codeVerifier = crypto
    .randomBytes(32)
    .toString('base64url');

  // Create SHA256 hash of the code verifier
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    codeVerifier,
    codeChallenge
  };
}

/**
 * Verify a PKCE code verifier against a challenge
 * @param codeVerifier The code verifier to verify
 * @param codeChallenge The expected code challenge
 * @returns True if the verifier matches the challenge
 */
export function verifyPkcePair(codeVerifier, codeChallenge) {
  const expectedChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return expectedChallenge === codeChallenge;
}
