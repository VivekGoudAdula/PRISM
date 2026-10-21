import type { Context, Next } from 'hono';

/**
 * Validates that critical secrets are properly configured in production environments.
 * Throws an explicit error if insecure defaults are detected in production.
 */
export function validateProductionSecrets(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const docKey = process.env.DOCUMENT_ENCRYPTION_KEY;

  if (isProduction) {
    if (!jwtSecret || jwtSecret === 'prism_default_secret_key_12345') {
      throw new Error(
        '[CRITICAL SECURITY ERROR] Insecure or default JWT_SECRET detected in production! Application refused to start.'
      );
    }

    if (!jwtRefreshSecret || jwtRefreshSecret === 'prism_default_refresh_secret_67890') {
      throw new Error(
        '[CRITICAL SECURITY ERROR] Insecure or default JWT_REFRESH_SECRET detected in production! Application refused to start.'
      );
    }

    if (!docKey || docKey.trim() === '') {
      throw new Error(
        '[CRITICAL SECURITY ERROR] DOCUMENT_ENCRYPTION_KEY is required in production! Application refused to start.'
      );
    }

    if (docKey.length < 32) {
      throw new Error(
        '[CRITICAL SECURITY ERROR] DOCUMENT_ENCRYPTION_KEY must be at least 32 bytes (256 bits) in production.'
      );
    }
  }
}

/**
 * Middleware: Enforces HTTPS / TLS in transit and applies enterprise security headers.
 */
export async function securityHeaders(c: Context, next: Next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Enforce HTTPS in production via reverse proxy protocol header
  if (isProduction) {
    const proto = c.req.header('x-forwarded-proto') || c.req.header('x-forwarded-ssl');
    if (proto && proto !== 'https' && proto !== 'on') {
      return c.json(
        {
          error: 'Upgrade Required',
          message: 'HTTPS is strictly required for all PRISM API communication.',
        },
        403
      );
    }
  }

  // 2. Add enterprise security headers (OWASP ASVS & DPDP Act compliance)
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Enforce HSTS (HTTP Strict Transport Security)
  if (isProduction) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  await next();
}

/**
 * Sanitizes error payloads to ensure credentials, file contents, or database connection
 * strings are never leaked to client responses.
 */
export function safeErrorHandler(err: Error, c: Context) {
  console.error('[SERVER ERROR]', err);

  const isProduction = process.env.NODE_ENV === 'production';
  const safeMessage = isProduction
    ? 'An internal server error occurred. Please contact security@prism.ai if this persists.'
    : err.message || 'Internal server error';

  return c.json(
    {
      error: 'Internal server error',
      message: safeMessage,
    },
    500
  );
}
