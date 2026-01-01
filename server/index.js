import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import security middleware
import { apiRateLimiter, authRateLimiter, heavyOperationRateLimiter, healthCheckRateLimiter } from './middleware/rateLimiter.js';
import { securityHeaders, preventKeyLeakage, validateEnv } from './middleware/security.js';
import logger from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP addresses (needed for rate limiting behind proxies/load balancers)
// This allows req.ip to correctly reflect the client IP from X-Forwarded-For header
app.set('trust proxy', 1);

// Path to Next.js static export
const FRONTEND_BUILD_PATH = join(__dirname, '..', 'frontend-UI', 'out');

// Security middleware - validate environment variables
app.use(validateEnv);

// Security headers
app.use(securityHeaders);

// Prevent API key leakage in responses
app.use(preventKeyLeakage);

// Middleware
const allowedOrigins = (
  process.env.APP_URLS ||
  [process.env.APP_URL, 'http://localhost:5173', 'http://localhost:4173']
    .filter(Boolean)
    .join(',')
)
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Also allow by hostname to be resilient to protocol/canonical differences
const allowedHostnames = allowedOrigins
  .map((o) => {
    try { return new URL(o).hostname; } catch { return null; }
  })
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const u = new URL(origin);
      const host = u.hostname;
      if (host === 'localhost') return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (allowedHostnames.includes(host)) return callback(null, true);
    } catch {}
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Response compression
app.use(compression());

// Lightweight request timing logger (helps spot slow endpoints)
app.use((req, res, next) => {
  const startedAtMs = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAtMs;
    // Keep logs concise in production
    logger.info(`${res.statusCode} ${req.method} ${req.originalUrl} ${durationMs}ms`);
  });
  next();
});

app.use(express.json());
app.use(cookieParser());

// Import routes
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

// Apply rate limiting to API routes
// Auth routes get stricter rate limiting
app.use('/api/auth', authRateLimiter);
// Heavy operations get their own rate limiter (applied in route handlers)
// General API routes get standard rate limiting
app.use('/api', apiRateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check with rate limiting
app.get('/health', healthCheckRateLimiter, (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve Next.js static export in production
if (existsSync(FRONTEND_BUILD_PATH)) {
  logger.info(`Serving frontend from ${FRONTEND_BUILD_PATH}`);
  
  // Serve static files from Next.js build
  app.use(express.static(FRONTEND_BUILD_PATH, {
    maxAge: '1d',
    etag: true,
  }));
  
  // Handle client-side routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }
    
    // Try to serve the specific page's HTML file (Next.js static export creates folder/index.html)
    const pagePath = req.path.endsWith('/') ? req.path : req.path + '/';
    const htmlFile = join(FRONTEND_BUILD_PATH, pagePath, 'index.html');
    
    if (existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    }
    
    // Try exact path with .html extension
    const exactHtmlFile = join(FRONTEND_BUILD_PATH, req.path + '.html');
    if (existsSync(exactHtmlFile)) {
      return res.sendFile(exactHtmlFile);
    }
    
    // Fallback to root index.html for client-side routing
    const rootIndex = join(FRONTEND_BUILD_PATH, 'index.html');
    if (existsSync(rootIndex)) {
      return res.sendFile(rootIndex);
    }
    
    next();
  });
} else {
  logger.info(`Frontend build not found at ${FRONTEND_BUILD_PATH} - API only mode`);
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // Sanitize error message to prevent information leakage
  let errorMessage = 'Something went wrong';
  if (process.env.NODE_ENV === 'development') {
    // In development, show error but sanitize secrets
    const msg = String(err.message || '');
    // Remove potential secrets from error messages
    errorMessage = msg
      .replace(/client_secret[=:]\S+/gi, 'client_secret=***')
      .replace(/secret[=:]\S+/gi, 'secret=***')
      .replace(/token[=:]\S+/gi, 'token=***')
      .replace(/key[=:]\S+/gi, 'key=***')
      .replace(/password[=:]\S+/gi, 'password=***');
  }
  
  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    message: errorMessage
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
