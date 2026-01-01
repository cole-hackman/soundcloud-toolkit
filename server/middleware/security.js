import helmet from 'helmet';
import logger from '../lib/logger.js';

/**
 * Security headers middleware
 * Configures helmet with appropriate security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Next.js
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "https:", "data:"], // Allow images from any HTTPS source
      connectSrc: ["'self'", "https://api.soundcloud.com", "https://secure.soundcloud.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for SoundCloud embeds if needed
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow SoundCloud resources
});

/**
 * Middleware to prevent API key leakage in error responses
 */
export const preventKeyLeakage = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Remove any potential secrets from response
    if (data && typeof data === 'object') {
      const sanitized = JSON.parse(JSON.stringify(data));
      removeSecrets(sanitized);
      return originalJson(sanitized);
    }
    return originalJson(data);
  };
  
  next();
};

/**
 * Recursively remove potential secrets from objects
 */
function removeSecrets(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  const secretKeys = [
    'password',
    'secret',
    'token',
    'key',
    'api_key',
    'client_secret',
    'access_token',
    'refresh_token',
    'encryption_key',
    'session_secret',
  ];
  
  for (const key in obj) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains secret-related terms
    if (secretKeys.some(secret => lowerKey.includes(secret))) {
      // Don't remove if it's a public identifier like 'client_id' in public context
      if (lowerKey === 'client_id' && typeof obj[key] === 'string') {
        // Keep client_id but ensure it's not a secret
        continue;
      }
      // Remove or mask the value
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      removeSecrets(obj[key]);
    }
  }
}

/**
 * Validate URL format
 */
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Middleware to validate environment variables are set and properly formatted
 */
export const validateEnv = (req, res, next) => {
  const errors = [];
  
  // Required environment variables with validation rules
  const requiredEnvVars = {
    'SOUNDCLOUD_CLIENT_ID': {
      required: true,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'SOUNDCLOUD_CLIENT_ID cannot be empty';
        }
        return null;
      }
    },
    'SOUNDCLOUD_CLIENT_SECRET': {
      required: true,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'SOUNDCLOUD_CLIENT_SECRET cannot be empty';
        }
        if (value.length < 8) {
          return 'SOUNDCLOUD_CLIENT_SECRET must be at least 8 characters';
        }
        return null;
      }
    },
    'SOUNDCLOUD_REDIRECT_URI': {
      required: true,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'SOUNDCLOUD_REDIRECT_URI cannot be empty';
        }
        if (!isValidUrl(value)) {
          return 'SOUNDCLOUD_REDIRECT_URI must be a valid HTTP/HTTPS URL';
        }
        return null;
      }
    },
    'ENCRYPTION_KEY': {
      required: true,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'ENCRYPTION_KEY cannot be empty';
        }
        if (value.length !== 32) {
          return 'ENCRYPTION_KEY must be exactly 32 characters';
        }
        return null;
      }
    },
    'SESSION_SECRET': {
      required: true,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'SESSION_SECRET cannot be empty';
        }
        if (value.length < 32) {
          return 'SESSION_SECRET must be at least 32 characters';
        }
        return null;
      }
    },
    'DATABASE_URL': {
      required: true,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'DATABASE_URL cannot be empty';
        }
        // Basic validation - should start with postgresql:// or similar
        if (!value.match(/^[a-z]+:\/\//i)) {
          return 'DATABASE_URL must be a valid database connection string';
        }
        return null;
      }
    }
  };
  
  // Check each required variable
  for (const [key, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];
    
    if (config.required && !value) {
      errors.push(`${key} is required but not set`);
      continue;
    }
    
    if (value && config.validate) {
      const validationError = config.validate(value);
      if (validationError) {
        errors.push(validationError);
      }
    }
  }
  
  if (errors.length > 0) {
    logger.error('Environment variable validation failed:', errors);
    
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Server is not properly configured. Check environment variables.'
    });
  }
  
  next();
};

