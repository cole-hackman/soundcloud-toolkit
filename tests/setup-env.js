/**
 * Test environment defaults.
 *
 * Five suites import modules that validate SoundCloud credentials at module
 * scope (`new SoundCloudClient()` throws on missing config). Without these set,
 * those suites fail to LOAD — which reads as "5 failed suites" and looks like a
 * broken test suite rather than a missing .env. That has already misled a
 * reader once.
 *
 * These are dummy values, deliberately not real credentials, and they never
 * override a value that is already set — so a developer with a real server/.env
 * keeps whatever they configured.
 */
process.env.SOUNDCLOUD_CLIENT_ID ||= 'test-client-id';
process.env.SOUNDCLOUD_CLIENT_SECRET ||= 'test-client-secret';
process.env.SOUNDCLOUD_REDIRECT_URI ||= 'http://localhost:3001/api/auth/callback';
process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);   // AES-256 needs exactly 32
process.env.SESSION_SECRET ||= 'y'.repeat(36);   // HMAC signing needs >= 32
