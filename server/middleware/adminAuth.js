/**
 * adminAuth middleware
 *
 * Must run AFTER authenticateUser (which populates req.user).
 * Checks req.user.soundcloudId against ADMIN_IDS env var
 * (comma-separated list of SoundCloud integer user IDs).
 *
 * Parsed fresh on each request so ADMIN_IDS can be updated without restart.
 */
export function adminAuth(req, res, next) {
  const adminIds = (process.env.ADMIN_IDS || '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => !isNaN(n) && n > 0);

  if (adminIds.length === 0) {
    return res.status(403).json({ error: 'Admin access not configured' });
  }

  if (!req.user || !adminIds.includes(req.user.soundcloudId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
