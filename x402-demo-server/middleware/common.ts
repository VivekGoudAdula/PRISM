import type { Context, Next } from 'hono';

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
      }

      // Re-inject body since we already read c.req.json() (hono req.json caching works, but this is safe)
      c.set('parsedBody', body);
      await next();
    } catch (err: any) {
      return c.json({ error: 'Invalid JSON request payload.' }, 400);
    }
  };
}
