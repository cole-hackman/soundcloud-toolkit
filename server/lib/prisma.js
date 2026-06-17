import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import logger from './logger.js';

// Neon (serverless Postgres) closes idle connections — the compute can suspend
// after inactivity and the pooler drops idle clients. Prisma keeps the now-dead
// connection in its pool and the next query fails with `Error { kind: Closed }`
// (or P1001/P1017). These are transient: a retry forces a fresh connection.
const TRANSIENT_DB_ERROR_CODES = ['P1001', 'P1017']; // unreachable / server closed the connection

function isTransientConnectionError(err) {
  if (!err) return false;
  if (TRANSIENT_DB_ERROR_CODES.includes(err.code)) return true;
  const msg = String(err.message || '');
  return /kind:\s*Closed|connection closed|connection reset|terminating connection/i.test(msg);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Retry only transient connection-level failures. App-level errors (validation,
  // unique-constraint P2002, etc.) are not transient and surface immediately.
  // Safe to retry every operation here: the app uses no interactive transactions
  // or raw queries, and a closed connection means the statement never executed.
  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const maxRetries = 2;
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (attempt >= maxRetries || !isTransientConnectionError(err)) throw err;
            const delay = 100 * (attempt + 1);
            logger.warn(
              `[prisma] transient DB connection error on ${model ?? 'raw'}.${operation} ` +
              `(attempt ${attempt + 1}/${maxRetries}); reconnecting in ${delay}ms`
            );
            await sleep(delay);
          }
        }
      },
    },
  });
}

// Prevent multiple instances of Prisma Client in development
export const prisma = globalThis.__prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma;
