# Security Implementation

This document outlines the security measures implemented in the SoundCloud Toolkit project.

## 1. Rate Limiting

Rate limiting has been implemented using `express-rate-limit` to protect against abuse and DoS attacks:

- **General API Rate Limiter**: 100 requests per 15 minutes per IP
  - Applied to all `/api/*` routes
  - Prevents general API abuse

- **Authentication Rate Limiter**: 5 attempts per 15 minutes per IP
  - Applied to `/api/auth/*` routes
  - Stricter limits for login endpoints
  - Skips counting successful requests

- **Heavy Operations Rate Limiter**: 20 requests per hour per IP
  - Applied to resource-intensive endpoints:
    - `/api/resolve` (URL resolution)
    - `/api/playlists/merge` (playlist merging)
    - `/api/playlists/from-likes` (creating playlists from likes)

- **Health Check Rate Limiter**: 60 requests per minute per IP
  - Applied to `/health` endpoint
  - Prevents health check abuse while allowing monitoring
  - Skips counting successful requests

Rate limiters use IP addresses for identification, with support for proxy headers (`X-Forwarded-For`).

## 2. Input Validation

Comprehensive input validation has been implemented using `express-validator`:

### Validated Endpoints

- **Playlist Operations**:
  - Playlist IDs validated as positive integers
  - Track arrays validated with length limits (max 500 tracks)
  - Titles sanitized and length-limited (max 200 characters)

- **URL Resolution**:
  - URLs validated for format and length (max 2048 characters)
  - Domain whitelist enforced (only SoundCloud domains allowed)
  - XSS prevention through input sanitization

- **Pagination**:
  - Limit values validated (1-200 range)
  - Offset values validated as non-negative integers
  - Cursor-based pagination URLs validated

- **Merge Operations**:
  - Source playlist IDs validated (2-10 playlists)
  - All IDs validated as positive integers
  - Title sanitization applied

All validation errors return structured error responses with field-level details.

## 3. API Key Protection

### Server-Side Only
- All API keys and secrets are stored in environment variables
- Never exposed in client-side code or API responses
- `.env` files are gitignored (`.gitignore` includes `.env*`)

### Secrets Management
- `SOUNDCLOUD_CLIENT_ID`: Public OAuth client ID (safe to expose in URLs)
- `SOUNDCLOUD_CLIENT_SECRET`: Server-side only, never sent to client
- `ENCRYPTION_KEY`: Used only for token encryption at rest
- `SESSION_SECRET`: Used only for session signing

### Response Sanitization
- Middleware (`preventKeyLeakage`) automatically removes potential secrets from API responses
- Error messages are sanitized to prevent information leakage
- Environment variable validation ensures required secrets are present

### Secure Logging
- Custom secure logging utility (`server/lib/logger.js`) sanitizes all log output
- Automatically removes secrets, tokens, and sensitive data from error logs
- Stack traces only included in development mode
- Recursive object sanitization prevents deep secret leakage
- All `console.error()` calls replaced with secure logger

### Client ID Usage
The `client_id` is used in public resolve endpoints (SoundCloud API requirement), which is acceptable as OAuth client IDs are public by design. The `client_secret` is never exposed.

## 4. SQL Injection Protection

### Prisma ORM
All database queries use Prisma ORM, which provides automatic protection against SQL injection:

- **Parameterized Queries**: Prisma automatically uses parameterized queries
- **Type Safety**: TypeScript/JavaScript type checking prevents invalid inputs
- **Query Builder**: No raw SQL strings are constructed from user input

### Verified Safe Queries
All database operations use Prisma methods:
- `prisma.user.findUnique()` - User lookup by ID
- `prisma.user.upsert()` - User creation/update
- `prisma.token.upsert()` - Token storage

### No Raw SQL
- No `$queryRaw` or `$executeRaw` calls found
- All queries use Prisma's type-safe query builder
- User input is validated before database operations

## 5. Additional Security Measures

### Security Headers (Helmet)
- Content Security Policy (CSP) configured
- XSS protection headers
- MIME type sniffing prevention
- Frame options (clickjacking protection)

### Error Handling
- Generic error messages in production
- Detailed errors only in development mode
- No stack traces exposed to clients
- Secrets filtered from error responses
- Secure logging utility sanitizes all error logs before output
- SoundCloud API error responses sanitized (response bodies not included in error messages)
- All error logging uses secure logger to prevent secret leakage

### Authentication
- Session cookies are HttpOnly and Secure
- PKCE flow for OAuth (prevents authorization code interception)
- Tokens encrypted at rest using AES-256-GCM
- Automatic token refresh on expiration

### CORS
- Strict origin whitelist
- Credentials required for authenticated requests
- Hostname-based validation for resilience

## Security Checklist

- ✅ Rate limiting implemented on all API endpoints (including health check)
- ✅ Input validation on all user inputs
- ✅ API keys stored in environment variables only
- ✅ No secrets exposed in client-side code
- ✅ Response sanitization prevents key leakage
- ✅ SQL injection protection via Prisma ORM
- ✅ Security headers via Helmet
- ✅ Error handling prevents information leakage
- ✅ Enhanced environment variable validation (format, length, empty string checks)
- ✅ CORS properly configured
- ✅ Secure logging utility prevents secret leakage in logs
- ✅ All error messages sanitized before logging
- ✅ SoundCloud API error responses sanitized

## Recent Security Enhancements

### Secure Logging System
- Implemented custom secure logging utility (`server/lib/logger.js`)
- All error logging now sanitizes secrets, tokens, and sensitive data
- Recursive object sanitization prevents deep secret leakage
- Stack traces only included in development mode

### Enhanced Environment Variable Validation
- Validates not just existence, but also format and length
- Encryption key must be exactly 32 characters
- Session secret must be at least 32 characters
- Database URL format validation
- Client secret minimum length validation
- Redirect URI must be valid HTTP/HTTPS URL

### Error Message Sanitization
- SoundCloud API error responses no longer include full response bodies
- Error messages sanitized to prevent token/secret leakage
- All error logging uses secure logger

### Complete Rate Limiting Coverage
- Health check endpoint now has rate limiting (60 requests/minute)
- All endpoints verified to have appropriate rate limiting

## Recommendations

1. **Regular Security Audits**: Periodically review dependencies for vulnerabilities (`npm audit`)
2. **Monitoring**: Set up monitoring for rate limit violations and suspicious activity
3. **Secrets Rotation**: Rotate API keys and secrets periodically
4. **HTTPS**: Ensure HTTPS is enforced in production (handled by hosting provider)
5. **Log Monitoring**: Monitor secure logs for patterns indicating security issues
6. **Security Testing**: Consider implementing automated security testing in CI/CD pipeline

