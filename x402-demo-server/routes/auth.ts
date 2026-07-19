import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { UserSession } from '../models/UserSession';
import { AuditLog } from '../models/AuditLog';
import { validateAuthBody } from '../middleware/common';
import { requireAuth } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'prism_default_secret_key_12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'prism_default_refresh_secret_key_12345';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

const authRouter = new Hono();

/**
 * Helper to generate tokens
 */
function generateTokens(user: { _id: any; email: string; role: string }) {
  const accessToken = jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId: user._id.toString() },
    JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  );

  return { accessToken, refreshToken };
}

/**
 * SIGNUP
 */
authRouter.post('/signup', validateAuthBody('signup'), async (c) => {
  try {
    const body = c.get('parsedBody');
    const { fullName, email, password } = body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return c.json({ error: 'An account with this email already exists.' }, 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // First user is Admin, others are regular users
    const isFirstUser = (await User.countDocuments({})) === 0;
    const role = isFirstUser ? 'admin' : 'user';

    const newUser = await User.create({
      fullName,
      email,
      passwordHash,
      role,
      subscriptionPlan: 'free',
      credits: 100,
    });

    const { accessToken, refreshToken } = generateTokens(newUser);

    // Save refresh token session
    await UserSession.create({
      userId: newUser._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      browser: c.req.header('user-agent') || 'Unknown Browser',
    });

    // Audit Log
    await AuditLog.create({
      userId: newUser._id,
      action: 'Signup',
      details: { email: newUser.email, role: newUser.role },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    return c.json({
      accessToken,
      refreshToken,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        credits: newUser.credits,
      },
    }, 201);
  } catch (error: any) {
    console.error('Signup Error:', error);
    return c.json({ error: 'Signup failed. Please try again.' }, 500);
  }
});

/**
 * LOGIN
 */
authRouter.post('/login', validateAuthBody('login'), async (c) => {
  try {
    const body = c.get('parsedBody');
    const { email, password } = body;

    const user = await User.findOne({ email });
    if (!user) {
      return c.json({ error: 'Account does not exist. Please sign up.' }, 400);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return c.json({ error: 'Incorrect password. Please try again.' }, 400);
    }

    const { accessToken, refreshToken } = generateTokens(user);

    user.lastLogin = new Date();
    await user.save();

    // Create session
    await UserSession.create({
      userId: user._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      browser: c.req.header('user-agent') || 'Unknown Browser',
    });

    // Audit Log
    await AuditLog.create({
      userId: user._id,
      action: 'Login',
      details: { email: user.email },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    return c.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        credits: user.credits,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error: any) {
    console.error('Login Error:', error);
    return c.json({ error: 'Login failed. Please try again.' }, 500);
  }
});

/**
 * REFRESH
 */
authRouter.post('/refresh', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { refreshToken } = body;

    if (!refreshToken) {
      return c.json({ error: 'Refresh token is required.' }, 400);
    }

    const session = await UserSession.findOne({ refreshToken });
    if (!session || session.expiresAt < new Date()) {
      if (session) await session.deleteOne();
      return c.json({ error: 'Session expired or invalid refresh token.' }, 401);
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) {
      return c.json({ error: 'User account not found.' }, 401);
    }

    // Generate new Access Token
    const accessToken = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Refresh last activity
    session.lastActivity = new Date();
    await session.save();

    return c.json({ accessToken });
  } catch (error: any) {
    console.error('Token Refresh Error:', error);
    return c.json({ error: 'Invalid refresh token.' }, 401);
  }
});

/**
 * LOGOUT
 */
authRouter.post('/logout', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { refreshToken } = body;

    if (refreshToken) {
      const session = await UserSession.findOne({ refreshToken });
      if (session) {
        // Audit log before deleting
        await AuditLog.create({
          userId: session.userId,
          action: 'Logout',
          ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
        });
        await session.deleteOne();
      }
    }

    return c.json({ message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('Logout Error:', error);
    return c.json({ error: 'Logout failed.' }, 500);
  }
});

/**
 * GET ME (check session status)
 */
authRouter.get('/me', requireAuth, async (c) => {
  const tokenUser = c.get('user');
  const user = await User.findById(tokenUser.userId).select('-passwordHash');
  if (!user) {
    return c.json({ error: 'User not found.' }, 404);
  }
  return c.json({ user });
});

/**
 * UPDATE WALLET CONNECTION
 */
authRouter.post('/connect-wallet', requireAuth, async (c) => {
  try {
    const tokenUser = c.get('user');
    const { walletAddress } = await c.req.json().catch(() => ({}));

    if (!walletAddress) {
      return c.json({ error: 'Wallet address is required.' }, 400);
    }

    const user = await User.findById(tokenUser.userId);
    if (!user) {
      return c.json({ error: 'User not found.' }, 404);
    }

    user.walletAddress = walletAddress;
    await user.save();

    // Audit Log
    await AuditLog.create({
      userId: user._id,
      action: 'Wallet Connected',
      details: { walletAddress },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    return c.json({ success: true, walletAddress });
  } catch (error: any) {
    console.error('Connect Wallet API Error:', error);
    return c.json({ error: 'Failed to update wallet address.' }, 500);
  }
});

export default authRouter;
