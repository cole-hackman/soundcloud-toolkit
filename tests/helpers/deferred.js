/**
 * A promise plus its resolver, so a test can hold an async step open — a
 * crawl, a snapshot write — and land a mutation while it is still in flight.
 * Shared by the social-cache suites; keep the two in step by importing this
 * rather than redefining it.
 */
export const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

/** Let scheduled continuations run. One macrotask turn drains the microtask
 *  queue and any setImmediate-scheduled work. */
export const flush = () => new Promise((r) => setImmediate(r));
