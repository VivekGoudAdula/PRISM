import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiGift,
  FiAward,
  FiCalendar,
  FiCheckCircle,
  FiShield,
  FiAlertTriangle,
  FiArrowRight,
  FiChevronLeft,
  FiTrendingUp,
  FiUsers,
  FiInfo,
} from 'react-icons/fi';
import { api } from '../utils/api';
import { resolveCampaignRewards } from '../utils/referralUtils';

/**
 * Public Referral Campaign Page (/campaign)
 * Displays active campaign dates, point values, qualification criteria,
 * and eligibility constraints without requiring user authentication.
 */
export const CampaignPage: React.FC = () => {
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [refCode, setRefCode] = useState<string>('');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Referral Campaign & Rules | PRISM';

    // Auto-detect and persist referral code from URL parameter ?ref=CODE
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam && refParam.trim().length > 0) {
      const cleanRef = refParam.trim().toUpperCase();
      localStorage.setItem('prism_ref_code', cleanRef);
      setRefCode(cleanRef);
    } else {
      const storedRef = localStorage.getItem('prism_ref_code');
      if (storedRef) {
        setRefCode(storedRef);
      }
    }

    const fetchCampaign = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/api/referrals/campaign');
        setCampaign(data?.campaign || null);
      } catch (err: any) {
        console.error('Failed to load campaign details:', err);
        setError('Unable to load real-time campaign rules. Showing standard terms.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, []);

  // Single Source of Truth: Inspect top-level and rewards subdocument returned by backend
  const { referrerPoints, refereePoints } = resolveCampaignRewards(campaign);

  const camp = campaign || {
    name: 'PRISM Pioneer Referral Program',
    code: 'LAUNCH2026',
    description: 'Invite creators, developers, and enterprises to optimize AI workloads and verify smart contracts with PRISM.',
    referrerPoints: 5,
    refereePoints: 10,
    startDate: '2026-01-01',
    endDate: null,
    rulesVersion: '1.0',
    qualificationCriteria: {
      minTaskCostUSD: 0.01,
      allowedNetworks: ['MAINNET', 'TESTNET'],
      requirePaymentCompleted: true,
      disallowMockSignaturesInProd: true,
    },
    limits: {
      maxReferralsPerUser: 0,
      totalCampaignBudgetPoints: 0,
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-amber-500 selection:text-slate-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 text-white hover:opacity-90 transition-opacity">
          <img src="/logo.png" alt="PRISM Logo" className="h-8 md:h-9 w-auto object-contain" />
          <span className="font-bold tracking-tight text-base text-white">Referral Program</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="btn btn-sm btn-ghost text-slate-300 hover:text-white text-xs font-semibold gap-1"
          >
            <FiChevronLeft className="text-sm" />
            <span>Console</span>
          </Link>
          <Link
            to={refCode ? `/signup?ref=${encodeURIComponent(refCode)}` : '/signup'}
            className="btn btn-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border-none font-bold text-xs rounded-xl shadow-md shadow-amber-500/10 gap-1.5"
          >
            <span>Claim Referral Code</span>
            <FiArrowRight className="text-xs" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto animate-fade-in flex flex-col items-center">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <img src="/logo.png" alt="PRISM" className="h-14 sm:h-16 w-auto object-contain mb-1 drop-shadow-md" />
          </Link>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <FiGift className="text-amber-400" />
            <span>Active Campaign • Algorand x402</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {camp.name}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            {camp.description}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className="badge badge-outline border-slate-700 text-slate-300 text-xs font-mono py-3 px-3">
              Code: <strong className="text-white ml-1 font-bold">{camp.code}</strong>
            </span>
            <span className="badge badge-outline border-slate-700 text-slate-300 text-xs font-mono py-3 px-3">
              Rules v{camp.rulesVersion || '1.0'}
            </span>
            <span className="badge badge-success text-[10px] font-extrabold uppercase py-3 px-3">
              Live & Qualifying
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2 max-w-2xl mx-auto">
            <FiInfo className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Key Point Values (Dual Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-950 border border-amber-500/30 space-y-3 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <FiAward className="text-amber-400" />
                <span>Referrer Reward</span>
              </span>
              <span className="badge badge-sm badge-warning text-[10px] font-mono text-slate-950 font-bold">Per Qualified User</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-white">
                {loading ? <span className="text-3xl text-slate-500 animate-pulse">...</span> : `+${referrerPoints}`}
              </span>
              <span className="text-amber-300 font-bold text-lg">points</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Awarded directly into your auditable append-only ledger when an invited developer or company completes their first verified paid AI execution.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-950 border border-indigo-500/30 space-y-3 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <FiGift className="text-indigo-400" />
                <span>New User Welcome Bonus</span>
              </span>
              <span className="badge badge-sm badge-primary text-[10px] font-mono font-bold">On First Paid Task</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-white">
                {loading ? <span className="text-3xl text-slate-500 animate-pulse">...</span> : `+${refereePoints}`}
              </span>
              <span className="text-indigo-300 font-bold text-lg">points</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Welcomed developers binding an active referral code upon registration automatically receive a bonus on completion of their qualifying AI execution.
            </p>
          </div>
        </div>

        {/* Qualification Criteria & Constraints (The Invariant) */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FiShield className="text-amber-400" />
              <span>Qualification Rules & Eligibility</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              To preserve program integrity, points are earned strictly through real platform usage verified on Algorand.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FiCheckCircle className="text-emerald-400 text-sm" />
                <span>Genuine Paid Task Required</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Referral points are awarded <strong>only after the referred user completes their first genuine paid AI task</strong> settled on Algorand via x402. Unpaid requests, free tiers, and cancelled executions do not qualify.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FiCheckCircle className="text-emerald-400 text-sm" />
                <span>Minimum Cost Threshold</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                The qualifying execution must satisfy a minimum cost of at least <strong className="text-white">${camp.qualificationCriteria?.minTaskCostUSD || '0.01'} USD</strong>, settled on MainNet or TestNet.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FiCheckCircle className="text-emerald-400 text-sm" />
                <span>Strict Sybil & Self-Referral Prevention</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Self-referrals, matching wallet addresses, duplicate attributions, and circular chains are automatically prevented by atomic database uniqueness constraints.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FiCheckCircle className="text-emerald-400 text-sm" />
                <span>One Referrer per Referee</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Attribution is permanently bound at signup or first wallet binding. Once locked, the referrer relationship cannot be modified or transferred.
              </p>
            </div>
          </div>

          {/* Campaign Schedule & Limits */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <FiCalendar className="text-indigo-400" />
              <span><strong>Start Date:</strong> {new Date(camp.startDate || '2026-01-01').toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-indigo-400" />
              <span><strong>End Date:</strong> {camp.endDate ? new Date(camp.endDate).toLocaleDateString() : 'Ongoing / Phase 1'}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiUsers className="text-amber-400" />
              <span><strong>Per-User Cap:</strong> {camp.limits?.maxReferralsPerUser > 0 ? `${camp.limits.maxReferralsPerUser} users` : 'Uncapped'}</span>
            </div>
          </div>
        </div>

        {/* Crucial Prize Status Notice (Requirement: Do not display prizes as available while disabled) */}
        <div className="p-6 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <FiInfo className="text-2xl" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 className="text-sm font-bold text-indigo-200">
              Prize Redemption Notice (Phase 1 Status)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Physical merchandise and token redemptions are <strong>currently disabled for this phase</strong>. All points earned are securely documented in your immutable, append-only ledger and will carry forward to Phase 2 platform privileges, compute discounts, and tier privileges.
            </p>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-indigo-500/15 border border-amber-500/40 text-center space-y-4 shadow-2xl">
          <h2 className="text-2xl font-bold text-white">
            Ready to Start Referring Developers?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Log in to your PRISM account or sign up to obtain your unique Crockford Base32 referral code and one-click direct invite link.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate(refCode ? `/signup?ref=${encodeURIComponent(refCode)}` : '/signup')}
              className="btn btn-primary rounded-xl font-bold text-xs px-6 gap-2"
            >
              <span>Create Account & Get Code</span>
              <FiArrowRight />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-outline border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold px-5"
            >
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 px-4 sm:px-8 py-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>© 2026 PRISM Orchestration • Settled on Algorand</span>
        <div className="flex items-center gap-4 text-slate-400">
          <Link to="/terms" className="hover:text-indigo-400 transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link to="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link to="/app" className="hover:text-indigo-400 transition-colors">Platform App</Link>
        </div>
      </footer>
    </div>
  );
};

export default CampaignPage;
