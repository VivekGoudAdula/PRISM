import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { UserSession } from '../models/UserSession';
import { AuditLog } from '../models/AuditLog';
import { LegalConsent } from '../models/LegalConsent';
import { Task } from '../models/Task';
import { SemanticCache } from '../models/SemanticCache';
import { Conversation, Message } from '../models/Chat';
import { DataMap } from '../models/DataMap';
import { PromptOptimization } from '../models/PromptOptimization';
import { PromptAnalysis } from '../models/PromptAnalysis';
import { CURRENT_LEGAL_VERSIONS } from '../legal.config';
import { validateAuthBody } from '../middleware/common';
import { requireAuth, optionalAuth, getJwtSecret } from '../middleware/auth';

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret === 'prism_default_refresh_secret_key_12345')) {
    throw new Error('[SECURITY CRITICAL] Insecure or missing JWT_REFRESH_SECRET in production');
  }
  return secret || 'prism_default_refresh_secret_key_12345';
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

const authRouter = new Hono();

/**
 * Sanitizes client IP and user-agent string for audit logs and session tracking,
 * adhering to data minimization principles under DPDP Act 2023 / GDPR.
 */
function extractSanitizedClientMetadata(c: any): { ipAddress: string; userAgent: string } {
  const forwarded = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
  // Parse first IP if comma-separated list from reverse proxy, capped at standard IPv6 length
  const firstIp = forwarded.split(',')[0].trim().slice(0, 45);
  // Truncate user-agent to 120 characters to minimize unnecessary client fingerprinting
  const rawAgent = c.req.header('user-agent') || 'Unknown Browser';
  const userAgent = rawAgent.slice(0, 120);
  return { ipAddress: firstIp, userAgent };
}

/**
 * Helper to generate tokens
 */
function generateTokens(user: { _id: any; email: string; role: string }) {
  const accessToken = jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId: user._id.toString(), jti: Math.random().toString(36).slice(2) + Date.now().toString(36) },
    getJwtRefreshSecret(),
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  );

  return { accessToken, refreshToken };
}

/**
 * SIGNUP
 * Validates credentials and required legal consent server-side,
 * generates authoritative server timestamps, and stores immutable versioned consent records.
 */
authRouter.post('/signup', validateAuthBody('signup'), async (c) => {
  try {
    const body = (c as any).get('parsedBody');
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

    const serverNow = new Date();

    const newUser = await User.create({
      fullName,
      email,
      passwordHash,
      role,
      subscriptionPlan: 'free',
      credits: 100,
      termsAcceptedVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
      privacyAcceptedVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      legalConsentAcceptedAt: serverNow,
    });

    const { ipAddress, userAgent } = extractSanitizedClientMetadata(c);

    // Create auditable, versioned consent record.
    // If this fails, roll back account creation to maintain transactional integrity.
    try {
      await LegalConsent.create({
        userId: newUser._id,
        userEmail: newUser.email,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
        revisionId: CURRENT_LEGAL_VERSIONS.revisionId,
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: true,
        acceptedAt: serverNow,
        signupFlow: 'email_signup',
        ipAddress,
        userAgent,
        status: 'active',
      });
    } catch (consentErr) {
      // Roll back user creation so partially failed requests never persist unconsented accounts
      await User.findByIdAndDelete(newUser._id).catch(() => {});
      console.error('Legal Consent Recording Failed on Signup:', consentErr);
      return c.json({ error: 'Failed to record legal consent. Account creation aborted.' }, 500);
    }

    const { accessToken, refreshToken } = generateTokens(newUser);

    // Save refresh token session
    await UserSession.create({
      userId: newUser._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      ipAddress,
      browser: userAgent,
    });

    // Audit Log
    await AuditLog.create({
      userId: newUser._id,
      action: 'Signup',
      details: {
        email: newUser.email,
        role: newUser.role,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      },
      ipAddress,
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
        termsAcceptedVersion: newUser.termsAcceptedVersion,
        privacyAcceptedVersion: newUser.privacyAcceptedVersion,
        legalConsentAcceptedAt: newUser.legalConsentAcceptedAt,
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
    const body = (c as any).get('parsedBody');
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

    const { ipAddress, userAgent } = extractSanitizedClientMetadata(c);

    // Create session
    await UserSession.create({
      userId: user._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      ipAddress,
      browser: userAgent,
    });

    // Audit Log
    await AuditLog.create({
      userId: user._id,
      action: 'Login',
      details: { email: user.email },
      ipAddress,
    });

    const isTermsCurrent = user.termsAcceptedVersion === CURRENT_LEGAL_VERSIONS.termsVersion;
    const isPrivacyCurrent = user.privacyAcceptedVersion === CURRENT_LEGAL_VERSIONS.privacyVersion;
    const hasActiveConsent = Boolean(user.termsAcceptedVersion && user.privacyAcceptedVersion);

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
      consentStatus: hasActiveConsent ? (isTermsCurrent && isPrivacyCurrent ? 'active' : 'requires_renewal') : 'requires_affirmation',
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

    const decoded = jwt.verify(refreshToken, getJwtRefreshSecret()) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) {
      return c.json({ error: 'User account not found.' }, 401);
    }

    // Generate new Access Token
    const accessToken = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Refresh last activity safely
    await UserSession.updateOne({ _id: session._id }, { lastActivity: new Date() }).catch(() => {});

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
  const tokenUser = (c as any).get('user');
  const user = await User.findById(tokenUser.userId).select('-passwordHash');
  if (!user) {
    return c.json({ error: 'User not found.' }, 404);
  }
  return c.json({ user });
});

/**
 * UPDATE WALLET CONNECTION (Authenticates existing users or registers new wallet users with consent)
 */
authRouter.post('/connect-wallet', optionalAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    const body = await c.req.json().catch(() => ({}));
    const { walletAddress, agreedToTerms, acknowledgedPrivacyPolicy, termsVersion, privacyVersion } = body;

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim().length === 0) {
      return c.json({ error: 'Wallet address is required.' }, 400);
    }

    const cleanWallet = walletAddress.trim();
    let user = null;

    if (tokenUser && tokenUser.userId) {
      user = await User.findById(tokenUser.userId);
    }

    if (!user) {
      user = await User.findOne({ walletAddress: cleanWallet });
      if (!user) {
        const dummyEmail = `wallet_${cleanWallet.toLowerCase()}@prism.ai`;
        user = await User.findOne({ email: dummyEmail });
        
        // If still no user exists, this is a NEW account registration via Web3 wallet
        if (!user) {
          // Require affirmative legal consent before account creation
          if (agreedToTerms !== true || acknowledgedPrivacyPolicy !== true) {
            return c.json({
              error: 'Legal consent required for registration. You must agree to the PRISM Terms of Service and Privacy Policy.',
              requiresConsent: true,
              currentVersions: CURRENT_LEGAL_VERSIONS,
            }, 403);
          }

          if (
            !termsVersion ||
            termsVersion !== CURRENT_LEGAL_VERSIONS.termsVersion ||
            !privacyVersion ||
            privacyVersion !== CURRENT_LEGAL_VERSIONS.privacyVersion
          ) {
            return c.json({
              error: `Unsupported or outdated legal document versions. Expected Terms ${CURRENT_LEGAL_VERSIONS.termsVersion} and Privacy ${CURRENT_LEGAL_VERSIONS.privacyVersion}.`,
              requiresConsent: true,
              currentVersions: CURRENT_LEGAL_VERSIONS,
            }, 400);
          }

          const serverNow = new Date();

          user = await User.create({
            fullName: `Wallet User (${cleanWallet.slice(0, 6)}...${cleanWallet.slice(-4)})`,
            email: dummyEmail,
            passwordHash: 'wallet_connected_auth',
            role: 'user',
            walletAddress: cleanWallet,
            subscriptionPlan: 'free',
            credits: 100,
            termsAcceptedVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
            privacyAcceptedVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
            legalConsentAcceptedAt: serverNow,
          });

          const { ipAddress: walletIp, userAgent: walletAgent } = extractSanitizedClientMetadata(c);

          // Record immutable versioned consent for wallet account
          try {
            await LegalConsent.create({
              userId: user._id,
              userEmail: user.email,
              termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
              privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
              revisionId: CURRENT_LEGAL_VERSIONS.revisionId,
              agreedToTerms: true,
              acknowledgedPrivacyPolicy: true,
              acceptedAt: serverNow,
              signupFlow: 'wallet_connect',
              ipAddress: walletIp,
              userAgent: walletAgent,
              status: 'active',
            });
          } catch (consentErr) {
            await User.findByIdAndDelete(user._id).catch(() => {});
            console.error('Consent recording failed for wallet user:', consentErr);
            return c.json({ error: 'Failed to record legal consent for wallet user.' }, 500);
          }
        }
      }
    }

    user.walletAddress = cleanWallet;
    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);
    const { ipAddress: connIp, userAgent: connAgent } = extractSanitizedClientMetadata(c);

    await UserSession.create({
      userId: user._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      ipAddress: connIp,
      browser: connAgent,
    }).catch(() => {});

    await AuditLog.create({
      userId: user._id,
      action: 'Wallet Connected',
      details: { walletAddress: cleanWallet },
      ipAddress: connIp,
    }).catch(() => {});

    return c.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        credits: user.credits,
        walletAddress: user.walletAddress,
        subscriptionPlan: user.subscriptionPlan,
        termsAcceptedVersion: user.termsAcceptedVersion,
        privacyAcceptedVersion: user.privacyAcceptedVersion,
        legalConsentAcceptedAt: user.legalConsentAcceptedAt,
      },
    });
  } catch (error: any) {
    console.error('Connect Wallet API Error:', error);
    return c.json({ error: 'Failed to update wallet address.' }, 500);
  }
});

/**
 * GET CONSENT STATUS
 * Returns the current authenticated user's active legal consent record,
 * compliance status against active platform policies, and full historical log.
 */
authRouter.get('/consent-status', requireAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    const user = await User.findById(tokenUser.userId);
    if (!user) {
      return c.json({ error: 'User not found.' }, 404);
    }

    const history = await LegalConsent.find({ userId: user._id }).sort({ acceptedAt: -1 }).limit(20);
    const activeConsent = await LegalConsent.findOne({ userId: user._id, status: 'active' }).sort({ acceptedAt: -1 });

    const isTermsCurrent = user.termsAcceptedVersion === CURRENT_LEGAL_VERSIONS.termsVersion;
    const isPrivacyCurrent = user.privacyAcceptedVersion === CURRENT_LEGAL_VERSIONS.privacyVersion;
    const consentRevoked = !activeConsent;
    const needsRenewedConsent = !isTermsCurrent || !isPrivacyCurrent || consentRevoked;

    return c.json({
      currentVersions: CURRENT_LEGAL_VERSIONS,
      userAccepted: {
        termsVersion: user.termsAcceptedVersion || activeConsent?.termsVersion || null,
        privacyVersion: user.privacyAcceptedVersion || activeConsent?.privacyVersion || null,
        acceptedAt: user.legalConsentAcceptedAt || activeConsent?.acceptedAt || null,
        signupFlow: activeConsent?.signupFlow || null,
      },
      consentStatus: consentRevoked ? 'revoked' : (needsRenewedConsent ? 'outdated' : 'active'),
      consentExplanation: consentRevoked
        ? 'Consent was previously withdrawn. You can re-activate your account by re-affirming the PRISM Terms of Service and Privacy Policy.'
        : (needsRenewedConsent ? 'Platform policies have been updated and require renewed agreement.' : 'Legal consent is current.'),
      needsRenewedConsent,
      history,
    });
  } catch (err: any) {
    console.error('Consent Status Error:', err);
    return c.json({ error: 'Failed to retrieve legal consent status.' }, 500);
  }
});

/**
 * RENEW LEGAL CONSENT
 * Records renewed affirmative agreement when platform policies are materially updated
 * or when reactivating an account after previous consent withdrawal.
 * Preserves all prior historical consent records without overwriting.
 */
authRouter.post('/renew-consent', requireAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    const user = await User.findById(tokenUser.userId);
    if (!user) {
      return c.json({ error: 'User not found.' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { agreedToTerms, acknowledgedPrivacyPolicy, termsVersion, privacyVersion } = body;

    if (agreedToTerms !== true) {
      return c.json({ error: 'You must agree to the updated Terms of Service.' }, 400);
    }

    if (acknowledgedPrivacyPolicy !== true) {
      return c.json({ error: 'You must acknowledge the updated Privacy Policy.' }, 400);
    }

    if (
      !termsVersion ||
      termsVersion !== CURRENT_LEGAL_VERSIONS.termsVersion ||
      !privacyVersion ||
      privacyVersion !== CURRENT_LEGAL_VERSIONS.privacyVersion
    ) {
      return c.json({
        error: `Version mismatch. Expected Terms ${CURRENT_LEGAL_VERSIONS.termsVersion} and Privacy ${CURRENT_LEGAL_VERSIONS.privacyVersion}.`,
      }, 400);
    }

    // Mark previous active records as superseded (historical audit trail is strictly preserved)
    await LegalConsent.updateMany(
      { userId: user._id, status: 'active' },
      { status: 'superseded' }
    );

    const now = new Date();
    const { ipAddress: renewIp, userAgent: renewAgent } = extractSanitizedClientMetadata(c);

    const newConsent = await LegalConsent.create({
      userId: user._id,
      userEmail: user.email,
      termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
      privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      revisionId: CURRENT_LEGAL_VERSIONS.revisionId,
      agreedToTerms: true,
      acknowledgedPrivacyPolicy: true,
      acceptedAt: now,
      signupFlow: 'renewed_acceptance',
      ipAddress: renewIp,
      userAgent: renewAgent,
      status: 'active',
    });

    user.termsAcceptedVersion = CURRENT_LEGAL_VERSIONS.termsVersion;
    user.privacyAcceptedVersion = CURRENT_LEGAL_VERSIONS.privacyVersion;
    user.legalConsentAcceptedAt = now;
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'Legal Consent Renewed',
      details: {
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      },
      ipAddress: renewIp,
    });

    return c.json({
      success: true,
      message: 'Legal consent updated successfully.',
      consent: newConsent,
    });
  } catch (err: any) {
    console.error('Renew Consent Error:', err);
    return c.json({ error: 'Failed to record renewed legal consent.' }, 500);
  }
});

/**
 * ACCOUNT DATA ACCESS & ERASURE REQUESTS
 * Implements transparent GDPR / DPDP Act 2023 data rights requests.
 */
authRouter.post('/data-request', requireAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    const user = await User.findById(tokenUser.userId).select('-passwordHash');
    if (!user) {
      return c.json({ error: 'User not found.' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { requestType, confirmed, notes } = body;

    if (!requestType || !['export', 'delete', 'withdraw_consent'].includes(requestType)) {
      return c.json({ error: 'Invalid requestType. Must be "export", "delete", or "withdraw_consent".' }, 400);
    }

    const { ipAddress } = extractSanitizedClientMetadata(c);

    if (requestType === 'export') {
      const consents = await LegalConsent.find({ userId: user._id }).sort({ acceptedAt: -1 });
      const sessions = await UserSession.find({ userId: user._id }).select('browser ipAddress createdAt lastActivity expiresAt');

      await AuditLog.create({
        userId: user._id,
        action: 'Data Export Requested',
        details: { email: user.email },
        ipAddress,
      });

      return c.json({
        success: true,
        requestType: 'export',
        exportedAt: new Date(),
        data: {
          profile: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            walletAddress: user.walletAddress,
            role: user.role,
            subscriptionPlan: user.subscriptionPlan,
            credits: user.credits,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          legalConsents: consents,
          activeSessions: sessions,
        },
      });
    }

    if (requestType === 'delete') {
      const referenceId = `DEL-${user._id.toString().slice(-6).toUpperCase()}-${Date.now()}`;

      // If user provided explicit confirmation, execute safe verified erasure
      if (confirmed === true) {
        // 1. Scrub uploaded documents and AI outputs from Task collection
        const tasksWithFiles = await Task.countDocuments({
          userId: user._id,
          'plannerOutput.files': { $exists: true, $ne: [] },
        });

        await Task.updateMany(
          { userId: user._id },
          {
            $unset: {
              'plannerOutput.files': '',
              'plannerOutput.extractedFiles': '',
              output: '',
            },
            $set: { prompt: '[DELETED_USER_TASK]' },
          }
        );

        // 2. Purge semantic cache entries for this user
        const cacheDeleteResult = await SemanticCache.deleteMany({ userId: user._id });

        // 2b. Purge DataMaps, PromptOptimizations, and PromptAnalyses
        const dataMapDeleteResult = await DataMap.deleteMany({ userId: user._id });
        const promptOptDeleteResult = await PromptOptimization.deleteMany({ userId: user._id });
        const promptAnalysisDeleteResult = await PromptAnalysis.deleteMany({ userId: user._id });

        // 3. Purge chat conversations and individual messages
        const userConvs = await Conversation.find({ userId: user._id }).select('_id');
        const convIds = userConvs.map((cv) => cv._id);
        await Message.deleteMany({ conversationId: { $in: convIds } });
        const convDeleteResult = await Conversation.deleteMany({ userId: user._id });

        // 4. Terminate active user sessions
        const sessionDeleteResult = await UserSession.deleteMany({ userId: user._id });

        // 5. Anonymize user profile (scrub personal identifiers)
        user.fullName = 'Deleted User';
        user.email = `deleted_${user._id}@deleted.prism.ai`;
        user.walletAddress = '';
        user.termsAcceptedVersion = undefined;
        user.privacyAcceptedVersion = undefined;
        // Invalidate password so credentials can never be used again
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              fullName: 'Deleted User',
              email: `deleted_${user._id}@deleted.prism.ai`,
              walletAddress: '',
              passwordHash: 'account_purged',
            },
            $unset: {
              termsAcceptedVersion: 1,
              privacyAcceptedVersion: 1,
            },
          }
        );

        // 6. Mark legal consent records as revoked
        await LegalConsent.updateMany(
          { userId: user._id, status: 'active' },
          { status: 'revoked' }
        );

        // 7. Audit Log recording verified deletion execution with audit counts
        await AuditLog.create({
          userId: user._id,
          action: 'Verified Account Erasure Executed',
          details: {
            referenceId,
            tasksScrubbed: tasksWithFiles,
            semanticCachesDeleted: cacheDeleteResult.deletedCount,
            dataMapsDeleted: dataMapDeleteResult.deletedCount,
            promptOptimizationsDeleted: promptOptDeleteResult.deletedCount,
            promptAnalysesDeleted: promptAnalysisDeleteResult.deletedCount,
            conversationsDeleted: convDeleteResult.deletedCount,
            sessionsTerminated: sessionDeleteResult.deletedCount,
          },
          ipAddress,
        });

        return c.json({
          success: true,
          requestType: 'delete',
          status: 'verified_deletion_completed',
          referenceId,
          message: 'Personal data, uploaded documents, extracted text, chat histories, DataMaps, and semantic cache entries have been permanently purged. Statutory financial records and Algorand on-chain settlement transaction hashes are retained under legal and regulatory compliance exemptions.',
          auditSummary: {
            tasksScrubbed: tasksWithFiles,
            semanticCachesDeleted: cacheDeleteResult.deletedCount,
            dataMapsDeleted: dataMapDeleteResult.deletedCount,
            promptOptimizationsDeleted: promptOptDeleteResult.deletedCount,
            promptAnalysesDeleted: promptAnalysisDeleteResult.deletedCount,
            conversationsDeleted: convDeleteResult.deletedCount,
            sessionsTerminated: sessionDeleteResult.deletedCount,
            accountAnonymized: true,
            retainedUnderExemptions: [
              'Algorand on-chain transaction hashes (immutable public blockchain)',
              'x402 payment settlement receipts (tax, accounting, and anti-fraud regulations)',
              'Statutory audit log entry of erasure execution',
            ],
          },
        });
      }

      // If not confirmed with confirmed: true, register the request ticket pending user confirmation
      await AuditLog.create({
        userId: user._id,
        action: 'Account Deletion Requested',
        details: { email: user.email, notes: notes || '' },
        ipAddress,
      });

      return c.json({
        success: true,
        requestType: 'delete',
        status: 'pending_verification',
        referenceId,
        message: 'Deletion request initiated. To permanently purge uploaded documents, conversational data, and account records immediately, submit this request with confirmed: true. Note that Algorand blockchain settlement records and statutory accounting logs are retained as required by law.',
        requiresConfirmation: true,
      });
    }

    if (requestType === 'withdraw_consent') {
      await LegalConsent.updateMany(
        { userId: user._id, status: 'active' },
        { status: 'revoked' }
      );

      // Clear consent versions on User record while preserving the account
      await User.updateOne(
        { _id: user._id },
        {
          $unset: {
            termsAcceptedVersion: 1,
            privacyAcceptedVersion: 1,
          },
        }
      );

      await AuditLog.create({
        userId: user._id,
        action: 'Consent Withdrawn',
        details: { email: user.email },
        ipAddress,
      });

      // Invalidate active sessions
      await UserSession.deleteMany({ userId: user._id });

      return c.json({
        success: true,
        requestType: 'withdraw_consent',
        message: 'Legal consent has been withdrawn. Active sessions have been terminated. Authenticated platform capabilities are now disabled. Your account profile is preserved; you may log in and re-affirm consent at any time if you wish to resume using PRISM.',
      });
    }
  } catch (err: any) {
    console.error('Data Request Error:', err);
    return c.json({ error: 'Failed to process data request.' }, 500);
  }
});

export default authRouter;
