/**
 * PRISM Referral Program Utility Functions
 * Enforces sanitization, formatting, and privacy masking on client-side.
 */

/**
 * Normalizes a referral code to Crockford Base32 standard uppercase string.
 */
export function normalizeReferralCode(rawCode?: string | null): string {
  if (!rawCode || typeof rawCode !== 'string') return '';
  let cleaned = rawCode.trim().toUpperCase();
  if (cleaned.startsWith('REF=')) {
    cleaned = cleaned.replace(/^REF=/, '');
  }
  return cleaned.replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

/**
 * Builds a direct referral share URL.
 */
export function buildReferralShareUrl(origin: string, referralCode: string): string {
  const cleanCode = normalizeReferralCode(referralCode);
  if (!cleanCode) return origin;
  return `${origin}/signup?ref=${cleanCode}`;
}

/**
 * Validates that an administrative review reason meets the minimum 5-character audit requirement.
 */
export function validateReviewReason(reason: string): { isValid: boolean; message?: string } {
  const trimmed = reason ? reason.trim() : '';
  if (trimmed.length < 5) {
    return {
      isValid: false,
      message: 'A documented reason of at least 5 characters is required for the audit log.',
    };
  }
  return { isValid: true };
}

/**
 * Safe client-side name masking to prevent email or raw identifier leakage.
 */
export function maskClientDisplayName(identifier?: string | null): string {
  if (!identifier) return 'Anonymous';
  const clean = identifier.trim();

  // Email format
  if (clean.includes('@')) {
    const [local, domain] = clean.split('@');
    const masked = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}*`;
    return `${masked}@${domain}`;
  }

  // Algorand Address format (58 chars)
  if (clean.length > 16) {
    return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
  }

  // Full Name format
  if (clean.includes(' ')) {
    return clean
      .split(' ')
      .map((part) => (part.length > 2 ? `${part[0]}***${part[part.length - 1]}` : `${part[0]}*`))
      .join(' ');
  }

  return clean.length > 3 ? `${clean.slice(0, 2)}***` : `${clean}*`;
}

/**
 * Resolves standard referrer and referee reward points from campaign data.
 * Supports both flat campaign object and nested rewards subdocument.
 * Strictly defaults to official MVP values: 5 points (referrer) and 10 points (referee).
 */
export function resolveCampaignRewards(campaign?: any | null): { referrerPoints: number; refereePoints: number } {
  const referrerPoints =
    typeof campaign?.referrerPoints === 'number'
      ? campaign.referrerPoints
      : typeof campaign?.rewards?.referrerPoints === 'number'
      ? campaign.rewards.referrerPoints
      : 5;

  const refereePoints =
    typeof campaign?.refereePoints === 'number'
      ? campaign.refereePoints
      : typeof campaign?.rewards?.refereePoints === 'number'
      ? campaign.rewards.refereePoints
      : 10;

  return { referrerPoints, refereePoints };
}

/**
 * Formats reward display string ensuring +Points is never rendered without numbers.
 */
export function formatRewardBadge(points: number): string {
  const safePoints = typeof points === 'number' && !isNaN(points) ? points : 0;
  return `+${safePoints} points`;
}
