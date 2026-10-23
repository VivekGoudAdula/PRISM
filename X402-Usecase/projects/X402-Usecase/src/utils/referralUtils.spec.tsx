import {
  normalizeReferralCode,
  buildReferralShareUrl,
  validateReviewReason,
  maskClientDisplayName,
  resolveCampaignRewards,
  formatRewardBadge,
} from './referralUtils';

describe('PRISM Referral Utilities', () => {
  describe('normalizeReferralCode', () => {
    it('should normalize lowercase code and strip spaces', () => {
      expect(normalizeReferralCode('  prism-7x29k  ')).toBe('PRISM-7X29K');
    });

    it('should strip ref= prefixes', () => {
      expect(normalizeReferralCode('REF=PRISM-123')).toBe('PRISM-123');
    });

    it('should return empty string for null or non-string inputs', () => {
      expect(normalizeReferralCode(null)).toBe('');
      expect(normalizeReferralCode(undefined)).toBe('');
      expect(normalizeReferralCode('')).toBe('');
    });
  });

  describe('buildReferralShareUrl', () => {
    it('should construct a valid signup URL with the normalized referral code', () => {
      const url = buildReferralShareUrl('https://prism.app', 'prism-alice9');
      expect(url).toBe('https://prism.app/signup?ref=PRISM-ALICE9');
    });

    it('should return origin when referral code is missing', () => {
      const url = buildReferralShareUrl('https://prism.app', '');
      expect(url).toBe('https://prism.app');
    });
  });

  describe('validateReviewReason', () => {
    it('should reject reasons shorter than 5 characters', () => {
      const result = validateReviewReason('bad');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('at least 5 characters');
    });

    it('should reject whitespace-only strings', () => {
      const result = validateReviewReason('    ');
      expect(result.isValid).toBe(false);
    });

    it('should approve valid investigation reasons', () => {
      const result = validateReviewReason('Verified genuine developer account');
      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('maskClientDisplayName', () => {
    it('should properly mask email addresses to protect referee privacy', () => {
      expect(maskClientDisplayName('alice.walker@example.com')).toBe('a***r@example.com');
      expect(maskClientDisplayName('bob@prism.ai')).toBe('b***b@prism.ai');
    });

    it('should properly mask Algorand wallet addresses', () => {
      const wallet = '7NJQ2OQW74X3FZZ55G255K7IQLR2G65T63Y34J56S7DF762H7G4U764BBA';
      expect(maskClientDisplayName(wallet)).toBe('7NJQ...4BBA');
    });

    it('should mask full names', () => {
      expect(maskClientDisplayName('Alice Walker')).toBe('A***e W***r');
    });

    it('should handle undefined or null safely without throwing', () => {
      expect(maskClientDisplayName(null)).toBe('Anonymous');
      expect(maskClientDisplayName(undefined)).toBe('Anonymous');
    });
  });

  describe('resolveCampaignRewards & formatRewardBadge', () => {
    it('should safely default to official MVP rewards (5 referrer, 10 referee) when campaign is null/undefined', () => {
      expect(resolveCampaignRewards(null)).toEqual({ referrerPoints: 5, refereePoints: 10 });
      expect(resolveCampaignRewards(undefined)).toEqual({ referrerPoints: 5, refereePoints: 10 });
      expect(resolveCampaignRewards({})).toEqual({ referrerPoints: 5, refereePoints: 10 });
    });

    it('should resolve rewards from nested rewards subdocument returned by backend API', () => {
      const apiCampaign = {
        name: 'PRISM Pioneer Referral Program',
        code: 'LAUNCH2026',
        rewards: {
          referrerPoints: 5,
          refereePoints: 10,
        },
      };
      const result = resolveCampaignRewards(apiCampaign);
      expect(result.referrerPoints).toBe(5);
      expect(result.refereePoints).toBe(10);
    });

    it('should resolve rewards from top-level fields when provided', () => {
      const flatCampaign = {
        name: 'Custom Campaign',
        referrerPoints: 5,
        refereePoints: 10,
      };
      const result = resolveCampaignRewards(flatCampaign);
      expect(result.referrerPoints).toBe(5);
      expect(result.refereePoints).toBe(10);
    });

    it('should format reward badge string without ever rendering "+Points" without numbers', () => {
      expect(formatRewardBadge(5)).toBe('+5 points');
      expect(formatRewardBadge(10)).toBe('+10 points');
      expect(formatRewardBadge(NaN)).toBe('+0 points');
    });
  });
});
