import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

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
    console.log(`[${res.statusCode}] ${req.method} ${req.originalUrl} ${durationMs}ms`);
  });
  next();
});

app.use(express.json());
app.use(cookieParser());

// Import routes
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
