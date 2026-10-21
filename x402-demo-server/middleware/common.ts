import type { Context, Next } from 'hono';
import { CURRENT_LEGAL_VERSIONS } from '../legal.config';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // max requests per minute

/**
 * Rate Limiter Middleware
 */
export async function rateLimiter(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for') || 'local-ip';
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    record.count++;
    if (record.count > MAX_REQUESTS) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }
  }

  await next();
}

/**
 * Error Handling Middleware
 */
export async function errorMiddleware(err: Error, c: Context) {
  console.error('Unhandled Server Error:', err);
  return c.json({
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred'
  }, 500);
}

/**
 * Request Logger Middleware
 */
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const { method, path } = c.req;
  console.log(`[REQUEST] ${method.toUpperCase()} ${path} - Initiated`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`[RESPONSE] ${method.toUpperCase()} ${path} - Status ${c.res.status} (${duration}ms)`);
}

/**
 * Validation Middleware for Signup/Login
 * Enforces server-side field checks and mandatory legal consent on signup.
 */
export function validateAuthBody(type: 'signup' | 'login') {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      
      if (!body.email || typeof body.email !== 'string') {
        return c.json({ error: 'Valid email is required.' }, 400);
      }
      
      if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
        return c.json({ error: 'Password must be at least 6 characters long.' }, 400);
      }

      if (type === 'signup') {
        if (!body.fullName || typeof body.fullName !== 'string' || body.fullName.trim().length === 0) {
          return c.json({ error: 'Full name is required.' }, 400);
        }

        // Enforce Terms of Service acceptance
        if (body.agreedToTerms !== true) {
          return c.json({
            error: 'You must agree to the PRISM Terms of Service to create an account.',
            field: 'agreedToTerms'
          }, 400);
        }

        // Enforce Privacy Policy acknowledgment
        if (body.acknowledgedPrivacyPolicy !== true) {
          return c.json({
            error: 'You must acknowledge that you have read the PRISM Privacy Policy to create an account.',
            field: 'acknowledgedPrivacyPolicy'
          }, 400);
        }

        // Enforce valid Terms version
        if (!body.termsVersion || body.termsVersion !== CURRENT_LEGAL_VERSIONS.termsVersion) {
          return c.json({
            error: `Unsupported or outdated Terms of Service version (${body.termsVersion || 'none'}). Expected version ${CURRENT_LEGAL_VERSIONS.termsVersion}.`,
            field: 'termsVersion',
            expectedVersion: CURRENT_LEGAL_VERSIONS.termsVersion
          }, 400);
        }

        // Enforce valid Privacy Policy version
        if (!body.privacyVersion || body.privacyVersion !== CURRENT_LEGAL_VERSIONS.privacyVersion) {
          return c.json({
            error: `Unsupported or outdated Privacy Policy version (${body.privacyVersion || 'none'}). Expected version ${CURRENT_LEGAL_VERSIONS.privacyVersion}.`,
            field: 'privacyVersion',
            expectedVersion: CURRENT_LEGAL_VERSIONS.privacyVersion
          }, 400);
        }
      }

      // Re-inject validated body into context
      c.set('parsedBody', body);
      await next();
    } catch (err: any) {
      return c.json({ error: 'Invalid JSON request payload.' }, 400);
    }
  };
}
