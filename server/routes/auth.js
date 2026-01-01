import express from 'express';
import { createPkcePair } from '../lib/pkce.js';
import { signSession, unsignSession, parseSessionData, createSessionCookieOptions } from '../lib/session.js';
import { encrypt } from '../lib/crypto.js';
import { soundcloudClient } from '../lib/soundcloud-client.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * GET /api/auth/login
 * Generate PKCE pair and redirect to SoundCloud OAuth
 */
router.get('/login', async (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = createPkcePair();
    
    // Store code verifier in httpOnly cookie
    res.cookie('pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/'
    });

    // Remember app origin so callback can redirect to the right port (dev 5173 vs preview 4173)
    // Determine app origin from Origin header, else Referer, else env default
    let appOrigin = req.get('origin') || '';
    if (!appOrigin) {
      const ref = req.get('referer');
      if (ref) {
        try { appOrigin = new URL(ref).origin; } catch {}
      }
    }
    if (!appOrigin) appOrigin = process.env.APP_URL || 'http://localhost:4173';
    res.cookie('app_url', appOrigin, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/'
    });

    // Build SoundCloud OAuth URL (modern authorize endpoint)
    const authUrl = new URL('https://secure.soundcloud.com/authorize');
    authUrl.searchParams.set('client_id', process.env.SOUNDCLOUD_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.SOUNDCLOUD_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    // scope can be blank per spec; omit non-expiring (deprecated)
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    res.redirect(authUrl.toString());
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to initiate login' });
  }
});

/**
 * GET /api/auth/callback
 * Handle SoundCloud OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    const codeVerifier = req.cookies.pkce_verifier;
    const appUrlCookie = req.cookies.app_url;
    const appUrl = appUrlCookie || process.env.APP_URL;

    if (error) {
      logger.error('OAuth error:', error);
      res.clearCookie('pkce_verifier');
      res.clearCookie('app_url');
      return res.redirect(`${appUrl}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !codeVerifier) {
      res.clearCookie('pkce_verifier');
      res.clearCookie('app_url');
      return res.redirect(`${appUrl}/login?error=missing_code_or_verifier`);
    }

    // Exchange code for tokens
    const tokens = await soundcloudClient.exchangeCodeForTokens(code, codeVerifier);
    
    // Get user information
    const userInfo = await soundcloudClient.getMe(tokens.access_token, tokens.refresh_token);

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    // Encrypt tokens
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
    const encryptedRefreshToken = encrypt(tokens.refresh_token, encryptionKey);

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { soundcloudId: userInfo.id },
      update: {
        username: userInfo.username,
        displayName: userInfo.display_name,
        avatarUrl: userInfo.avatar_url,
        updatedAt: new Date()
      },
      create: {
        soundcloudId: userInfo.id,
        username: userInfo.username,
        displayName: userInfo.display_name,
        avatarUrl: userInfo.avatar_url
      }
    });

    // Store encrypted tokens
    await prisma.token.upsert({
      where: { userId: user.id },
      update: {
        encrypted: encryptedAccessToken,
        refresh: encryptedRefreshToken,
        expiresAt,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        encrypted: encryptedAccessToken,
        refresh: encryptedRefreshToken,
        expiresAt
      }
    });

    // Create session data
    const sessionData = {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName
    };

    // Sign and set session cookie
    const sessionValue = signSession(JSON.stringify(sessionData), process.env.SESSION_SECRET);
    res.cookie('session', sessionValue, createSessionCookieOptions());

    // Clear PKCE verifier and app origin cookies
    res.clearCookie('pkce_verifier');
    res.clearCookie('app_url');

    // Redirect to dashboard
    res.redirect(`${appUrl}/dashboard`);
  } catch (error) {
    logger.error('Callback error:', error);
    const appUrl = req.cookies.app_url || process.env.APP_URL;
    res.clearCookie('pkce_verifier');
    res.clearCookie('app_url');
    res.redirect(`${appUrl}/login?error=callback_failed`);
  }
});

/**
 * POST /api/auth/logout
 * Clear session and redirect to home
 */
router.post('/logout', async (req, res) => {
  try {
    // Clear session cookie
    res.clearCookie('session');
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * GET /api/auth/me
 * Get current user session
 */
router.get('/me', async (req, res) => {
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

    res.json(sessionData);
  } catch (error) {
    logger.error('Me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;
