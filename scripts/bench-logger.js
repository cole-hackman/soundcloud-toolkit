/**
 * Phase 4 measurement (docs/engineering-review-2026-08-25.md §8).
 * Answers one question: is preventKeyLeakage's response re-serialization, plus
 * logger sanitization, cheap enough to leave alone? Run: node scripts/bench-logger.js
 * Not part of the test suite and not a dependency of anything.
 */
import { performance } from 'node:perf_hooks';

process.env.NODE_ENV = 'production';
const { default: logger } = await import('../server/lib/logger.js');
const { preventKeyLeakage } = await import('../server/middleware/security.js');

const ITERATIONS = 20_000;

function bench(label, fn, silence = false) {
  // Silence logger output during warm-up and measurement if requested
  const realLog = console.log;
  const realWarn = console.warn;
  const realError = console.error;
  const noop = () => {};

  if (silence) {
    console.log = noop;
    console.warn = noop;
    console.error = noop;
  }

  fn(); // warm up JIT

  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const totalMs = performance.now() - start;

  if (silence) {
    console.log = realLog;
    console.warn = realWarn;
    console.error = realError;
  }

  const perOpUs = (totalMs / ITERATIONS) * 1000;
  console.log(`${label.padEnd(46)} ${perOpUs.toFixed(2)} µs/op   (${totalMs.toFixed(0)} ms total)`);
  return perOpUs;
}

const SHORT = '200 GET /api/playlists 154ms';
const WITH_SECRET =
  'resolve failed for https://api.soundcloud.com/me?oauth_token=abc123def456 token=zzz retrying';
const PAYLOAD = {
  collection: Array.from({ length: 50 }, (_, i) => ({
    id: i, title: `Track ${i}`, user: { id: i, username: `dj${i}` },
    artwork_url: `https://cdn/${i}.jpg`, duration: 210000,
  })),
  total: 50,
};

const noop = () => {};

console.log(`\nlogger + preventKeyLeakage overhead — ${ITERATIONS.toLocaleString()} iterations each\n`);

const clean = bench('logger.info, clean message', () => logger.info(SHORT), true);
const dirty = bench('logger.info, message containing secrets', () => logger.info(WITH_SECRET), true);
const withData = bench('logger.info, message + 50-item payload', () => logger.info(SHORT, PAYLOAD), true);

// preventKeyLeakage wraps res.json; measure one wrapped response cycle.
const middlewareCost = bench('preventKeyLeakage on a 50-track response', () => {
  const res = { json: (b) => b, locals: {} };
  preventKeyLeakage({ path: '/api/playlists' }, res, noop);
  res.json(PAYLOAD);
}, false);

const perRequestMs = (clean + middlewareCost) / 1000;
console.log(`\nTypical per-request cost (1 info log + 1 wrapped response): ${perRequestMs.toFixed(3)} ms`);
console.log(
  perRequestMs < 1
    ? 'VERDICT: negligible (<1ms) — keep preventKeyLeakage as-is, no follow-up needed.\n'
    : 'VERDICT: material (>=1ms) — open a follow-up issue to narrow or cache the re-serialization.\n'
);
