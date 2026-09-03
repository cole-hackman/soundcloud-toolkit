import { AsyncLocalStorage } from 'node:async_hooks';

const tokenContext = new AsyncLocalStorage();

export function runWithTokenContext(context, callback) {
  // The metrics bag counts SoundCloud round trips without threading a counter
  // through every client method. Callers pass in the bag they own (the request
  // timing middleware hangs one off `req`, so it can be read from a 'finish'
  // listener registered before this context exists); otherwise we make one.
  const metrics = context?.metrics ?? { scCalls: 0 };
  return tokenContext.run({ ...context, metrics }, callback);
}

export function getTokenContext() {
  return tokenContext.getStore() || null;
}

/** Count one SoundCloud round trip against the current request, if there is one. */
export function countScCall() {
  const store = tokenContext.getStore();
  if (store?.metrics) store.metrics.scCalls += 1;
}

/** SoundCloud round trips made so far by the current request (0 when unscoped). */
export function getScCallCount() {
  return tokenContext.getStore()?.metrics?.scCalls ?? 0;
}

/** A fresh metrics bag for a caller that owns the request lifetime. */
export function createScMetrics() {
  return { scCalls: 0 };
}
