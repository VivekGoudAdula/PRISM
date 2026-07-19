import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'prism_default_secret_key_12345';

export interface DecodedToken {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * Authentication Middleware
 * Validates JWT access token from Authorization header or cookie
 */
export async function requireAuth(c: Context, next: Next) {
  try {
    let token = '';

    // Check Authorization header
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Check cookie fallback (using Hono cookie helpers or simple header parsing)
    if (!token) {
      const cookieHeader = c.req.header('Cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, current) => {
          const [name, value] = current.trim().split('=');
          if (name && value) acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        token = cookies['access_token'] || '';
      }
    }

    if (!token) {
      return c.json({ error: 'Access token required. Please authenticate.' }, 401);
    }

    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    c.set('user', decoded);
    await next();
  } catch (error: any) {
    console.error('JWT Verification Error:', error.message);
    return c.json({ error: 'Invalid or expired access token. Please login again.' }, 401);
  }
}

/**
 * Admin authorization middleware
 */
export async function requireAdmin(c: Context, next: Next) {
  const user = c.get('user') as DecodedToken | undefined;
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required.' }, 403);
  }
  await next();
}
