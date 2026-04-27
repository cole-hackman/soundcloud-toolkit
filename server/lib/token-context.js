import { AsyncLocalStorage } from 'node:async_hooks';

const tokenContext = new AsyncLocalStorage();

export function runWithTokenContext(context, callback) {
  return tokenContext.run(context, callback);
}

export function getTokenContext() {
  return tokenContext.getStore() || null;
}
