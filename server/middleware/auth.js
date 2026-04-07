import { unsignSession, parseSessionData } from '../lib/session.js';
import { decrypt } from '../lib/crypto.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';

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

    req.user = user;
    req.accessToken = accessToken;
    req.refreshToken = refreshToken;

    next();
  } catch (error) {
    logger.error('Authentication error:', safeError(error));
    res.status(401).json({ error: 'Authentication failed' });
  }
}
