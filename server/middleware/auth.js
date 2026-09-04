import { unsignSession, parseSessionData } from '../lib/session.js';
import { decrypt } from '../lib/crypto.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { runWithTokenContext } from '../lib/token-context.js';
import { getCachedAuth, setCachedAuth } from '../lib/auth-cache.js';

/**
 * Middleware to authenticate requests via signed session cookie.
 * Sets req.user, req.accessToken, req.refreshToken on success.
 */
export async function authenticateUser(req, res, next) {
  try {
    const sessionCookie = req.cookies.session;

    if (!sessionCookie) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionValue = unsignSession(sessionCookie, process.env.SESSION_SECRET);
    if (!sessionValue) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const sessionData = parseSessionData(sessionValue);
    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid session data' });
    }

    // The session signature and its iat/TTL have already been verified above,
    // so by this point the userId is trusted. What follows is only the lookup
    // of the tokens that userId maps to — which is why it is safe to memo.
    const cached = getCachedAuth(sessionData.userId);
    if (cached) {
      req.user = cached.user;
      req.accessToken = cached.accessToken;
      req.refreshToken = cached.refreshToken;
    } else {
      // Get user and tokens from database
      const user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
        include: { tokens: true },
      });

      if (!user || !user.tokens.length) {
        return res.status(401).json({ error: 'User not found or no tokens' });
      }

      const token = user.tokens[0];
      const encryptionKey = process.env.ENCRYPTION_KEY;

      // Decrypt tokens
      const accessToken = decrypt(token.encrypted, encryptionKey);
      const refreshToken = decrypt(token.refresh, encryptionKey);

      setCachedAuth(sessionData.userId, { user, accessToken, refreshToken });

      req.user = user;
      req.accessToken = accessToken;
      req.refreshToken = refreshToken;
    }
  } catch (error) {
    logger.error('Authentication error:', safeError(error));
    return res.status(401).json({ error: 'Authentication failed' });
  }

  runWithTokenContext({ userId: req.user.id, metrics: req.scMetrics }, next);
}
