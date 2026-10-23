import React, { useState, useEffect } from 'react';
import {
  FiX,
  FiCopy,
  FiCheck,
  FiUsers,
  FiAward,
  FiGift,
  FiClock,
  FiTrendingUp,
  FiList,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiInfo,
  FiChevronLeft,
  FiChevronRight,
  FiShield,
  FiShare2,
} from 'react-icons/fi';
import { api } from '../utils/api';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ModalTab;
}

export type ModalTab = 'dashboard' | 'activity' | 'leaderboard' | 'campaign';

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose, initialTab = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);

  // Paginated Activity State
  const [attributions, setAttributions] = useState<any[]>([]);
  const [attrPage, setAttrPage] = useState<number>(1);
  const [attrPagination, setAttrPagination] = useState<any>({ total: 0, totalPages: 1, page: 1, limit: 10 });
  const [attrLoading, setAttrLoading] = useState<boolean>(false);

  // Paginated Ledger State
  const [ledger, setLedger] = useState<any>(null);
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerPagination, setLedgerPagination] = useState<any>({ total: 0, totalPages: 1, page: 1, limit: 10 });
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);

  // Paginated Leaderboard State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbPage, setLbPage] = useState<number>(1);
  const [lbPagination, setLbPagination] = useState<any>({ total: 0, totalPages: 1, page: 1, limit: 15 });
  const [lbLoading, setLbLoading] = useState<boolean>(false);
  const [lbPrivacyPolicy, setLbPrivacyPolicy] = useState<string>('');

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [sharedSuccess, setSharedSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Initial load
  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, campRes] = await Promise.allSettled([
        api.get('/api/referrals/me'),
        api.get('/api/referrals/campaign'),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data);
      }
      if (campRes.status === 'fulfilled') {
        setCampaign(campRes.value.data?.campaign);
      }
    } catch (err: any) {
      console.error('Error loading initial referral modal data:', err);
      setError('Failed to load referral summary. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch attributions with pagination
  const fetchAttributions = async (page: number) => {
    setAttrLoading(true);
    try {
      const { data } = await api.get(`/api/referrals/attributions?page=${page}&limit=10`);
      setAttributions(data?.attributions || []);
      if (data?.pagination) {
        setAttrPagination(data.pagination);
        setAttrPage(data.pagination.page);
      }
    } catch (err) {
      console.error('Failed to load attributions:', err);
    } finally {
      setAttrLoading(false);
    }
  };

  // Fetch ledger with pagination
  const fetchLedger = async (page: number) => {
    setLedgerLoading(true);
    try {
      const { data } = await api.get(`/api/referrals/ledger?page=${page}&limit=10`);
      setLedger(data);
      if (data?.pagination) {
        setLedgerPagination(data.pagination);
        setLedgerPage(data.pagination.page);
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Fetch leaderboard with pagination
  const fetchLeaderboard = async (page: number) => {
    setLbLoading(true);
    try {
      const { data } = await api.get(`/api/referrals/leaderboard?page=${page}&limit=15`);
      setLeaderboard(data?.leaderboard || []);
      if (data?.pagination) {
        setLbPagination(data.pagination);
        setLbPage(data.pagination.page);
      }
      if (data?.privacyPolicy) {
        setLbPrivacyPolicy(data.privacyPolicy);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLbLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      fetchAttributions(1);
      fetchLedger(1);
      fetchLeaderboard(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'code' | 'link') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShare = async (url: string, code: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PRISM AI Referral Program',
          text: `Join PRISM with my referral code ${code} and earn a 100 point welcome bonus on your first paid AI task!`,
          url,
        });
        setSharedSuccess(true);
        setTimeout(() => setSharedSuccess(false), 3000);
      } catch {
        handleCopy(url, 'link');
      }
    } else {
      handleCopy(url, 'link');
    }
  };

  const referralCode = profile?.referralCode || '...';
  const referralLink = profile?.shareUrl || `${window.location.origin}/signup?ref=${referralCode}`;
  const pointsBalance = profile?.pointsBalance ?? 0;
  const pointsEarned = profile?.pointsEarned ?? pointsBalance;
  const currentRank = profile?.rank || 'Unranked';
  const counts = profile?.counts || profile?.metrics || { totalReferred: 0, pendingCount: 0, qualifiedCount: 0 };
  const campData = campaign || profile?.campaign || {
    name: 'PRISM Pioneer Referral Program',
    referrerPoints: 5,
    refereePoints: 10,
    rulesVersion: '1.0',
    qualificationCriteria: { minTaskCostUSD: 0.01, allowedNetworks: ['MAINNET', 'TESTNET'] },
  };

  const referrerPts: number =
    typeof campData.referrerPoints === 'number'
      ? campData.referrerPoints
      : typeof campData.rewards?.referrerPoints === 'number'
      ? campData.rewards.referrerPoints
      : 5;

  const refereePts: number =
    typeof campData.refereePoints === 'number'
      ? campData.refereePoints
      : typeof campData.rewards?.refereePoints === 'number'
      ? campData.rewards.refereePoints
      : 10;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-600/20 to-indigo-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <FiGift className="text-xl" />
            </div>
            <div>
              <h2 id="referral-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                PRISM Referral Program
                <span className="badge badge-sm badge-warning text-[10px] font-extrabold uppercase tracking-wider text-slate-950">
                  Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Earn <span className="text-amber-300 font-bold">+{referrerPts} Points</span> for every developer or organization who completes their first paid AI task.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadInitialData();
                fetchAttributions(attrPage);
                fetchLedger(ledgerPage);
                fetchLeaderboard(lbPage);
              }}
              disabled={loading}
              title="Refresh referral metrics"
              aria-label="Refresh referral data"
              className="btn btn-ghost btn-circle btn-sm text-slate-400 hover:text-white"
            >
              <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="btn btn-ghost btn-circle btn-sm text-slate-400 hover:text-white"
            >
              <FiX className="text-lg" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'border-amber-400 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FiGift className="text-xs text-amber-400" />
            <span>Referral Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-amber-400 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FiUsers className="text-xs text-indigo-400" />
            <span>Activity & Ledger ({counts.totalReferred ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'border-amber-400 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FiAward className="text-xs text-amber-400" />
            <span>Leaderboard</span>
          </button>
          <button
            onClick={() => setActiveTab('campaign')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'campaign'
                ? 'border-amber-400 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FiInfo className="text-xs text-emerald-400" />
            <span>Campaign Rules</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <FiAlertCircle className="shrink-0 text-base" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: REFERRAL DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* Stat Cards - Comprehensive 5-KPI Responsive Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col">
                  <span className="text-[11px] text-slate-400 font-medium">Available Balance</span>
                  <span className="text-xl sm:text-2xl font-black text-amber-300 mt-1">{pointsBalance} pts</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Auditable points</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col">
                  <span className="text-[11px] text-slate-400 font-medium">Lifetime Points</span>
                  <span className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{pointsEarned} pts</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Total earned to date</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col">
                  <span className="text-[11px] text-slate-400 font-medium">Qualified Referrals</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{counts.qualifiedCount ?? 0}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Paid AI task completed</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col">
                  <span className="text-[11px] text-slate-400 font-medium">Total Referrals</span>
                  <span className="text-xl sm:text-2xl font-black text-white mt-1">{counts.totalReferred ?? 0}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Attributed accounts</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-slate-400 font-medium">Current Rank</span>
                  <span className="text-xl sm:text-2xl font-black text-indigo-300 mt-1">{currentRank}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Global leaderboard</span>
                </div>
              </div>

              {/* Share Code & Link Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900/80 to-indigo-950/40 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full md:w-auto">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1">
                    Your Personal Referral Code
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-mono font-black text-white bg-slate-950/90 px-4 py-1.5 rounded-xl border border-amber-500/40 tracking-wider">
                      {referralCode}
                    </span>
                    <button
                      onClick={() => handleCopy(referralCode, 'code')}
                      className="btn btn-sm bg-amber-500 text-slate-950 hover:bg-amber-400 border-none rounded-xl text-xs font-bold gap-1.5"
                    >
                      {copiedCode ? <FiCheck className="text-sm" /> : <FiCopy className="text-sm" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="w-full md:flex-1 md:max-w-md">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Direct Invite Link
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      aria-label="Direct referral URL"
                      value={referralLink}
                      className="input input-sm w-full bg-slate-950/80 border border-slate-700 font-mono text-xs text-slate-300 rounded-xl"
                    />
                    <button
                      onClick={() => handleShare(referralLink, referralCode)}
                      className="btn btn-sm btn-outline border-amber-500/50 text-amber-300 hover:bg-amber-500/20 rounded-xl text-xs font-bold gap-1 shrink-0"
                    >
                      {copiedLink || sharedSuccess ? <FiCheck /> : <FiShare2 />}
                      <span>{copiedLink || sharedSuccess ? 'Copied' : 'Share'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Crucial Single Source of Truth Qualification Explanation */}
              <div className="rounded-2xl bg-amber-500/5 border border-amber-500/25 p-4 flex items-start gap-3">
                <FiShield className="text-amber-400 text-lg shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-amber-200">
                    Important Qualification Rule:
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    Points are awarded <strong className="text-white">only after the referred user completes their first genuine paid AI task</strong> verified on-chain via Algorand x402 settlement. Unpaid requests, free trials, and failed or refunded executions do not qualify.
                  </p>
                </div>
              </div>

              {/* Active Campaign Summary */}
              <div className="rounded-2xl bg-slate-950/50 border border-slate-800/80 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Active Campaign: {campData.name} ({campData.code || 'LAUNCH2026'})
                  </span>
                  <span className="badge badge-sm badge-outline text-[10px] font-mono">v{campData.rulesVersion || '1.0'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Referrer Reward per Qualified User:</span>
                    <span className="font-bold text-amber-300">+{referrerPts} Points</span>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Referee Welcome Bonus on First Task:</span>
                    <span className="font-bold text-emerald-400">+{refereePts} Points</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REFERRAL ACTIVITY & POINTS LEDGER */}
          {activeTab === 'activity' && (
            <div className="space-y-6 animate-fade-in">
              {/* Activity Section 1: Attributed Users */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <FiUsers className="text-indigo-400" />
                      <span>Referred Accounts ({attrPagination.total})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      User identifiers are privacy-masked. Tasks and payment amounts are strictly withheld.
                    </p>
                  </div>
                </div>

                {attrLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="loading loading-spinner loading-md text-indigo-400" />
                  </div>
                ) : attributions.length === 0 ? (
                  <div className="text-center py-8 rounded-xl bg-slate-950/40 border border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-400">No attributed accounts yet.</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Share your link to invite your first user.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th>Masked User</th>
                          <th>Status</th>
                          <th>Attributed Date</th>
                          <th>Qualified Date</th>
                          <th className="text-right">Points Earned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attributions.map((a: any) => (
                          <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="font-semibold text-white font-mono">{a.referredUser || a.maskedRefereeName}</td>
                            <td>
                              {a.status === 'qualified' && (
                                <span className="badge badge-xs badge-success gap-1 text-[10px] font-bold">
                                  <FiCheckCircle /> Qualified
                                </span>
                              )}
                              {a.status === 'pending' && (
                                <span className="badge badge-xs badge-warning gap-1 text-[10px] font-bold">
                                  <FiClock /> Pending Task
                                </span>
                              )}
                              {a.status === 'rejected' && (
                                <span className="badge badge-xs badge-error gap-1 text-[10px] font-bold">
                                  Rejected
                                </span>
                              )}
                            </td>
                            <td className="text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</td>
                            <td className="text-slate-400">{a.qualifiedAt ? new Date(a.qualifiedAt).toLocaleDateString() : '—'}</td>
                            <td className="text-right font-mono font-bold text-amber-300">
                              {a.pointsEarned > 0 ? `+${a.pointsEarned}` : '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {attrPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/80 text-xs text-slate-400">
                        <span>Page {attrPagination.page} of {attrPagination.totalPages}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => fetchAttributions(attrPage - 1)}
                            disabled={attrPage <= 1 || attrLoading}
                            className="btn btn-ghost btn-xs text-xs"
                          >
                            <FiChevronLeft /> Prev
                          </button>
                          <button
                            onClick={() => fetchAttributions(attrPage + 1)}
                            disabled={attrPage >= attrPagination.totalPages || attrLoading}
                            className="btn btn-ghost btn-xs text-xs"
                          >
                            Next <FiChevronRight />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Activity Section 2: Append-Only Points Ledger */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <FiList className="text-amber-400" />
                      <span>Points Ledger ({ledgerPagination.total})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Append-only record of all reward credits and compensating adjustments.
                    </p>
                  </div>
                </div>

                {ledgerLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="loading loading-spinner loading-md text-amber-400" />
                  </div>
                ) : !ledger || !ledger.entries || ledger.entries.length === 0 ? (
                  <div className="text-center py-8 rounded-xl bg-slate-950/40 border border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-400">No points ledger transactions yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th>Date</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th className="text-right">Delta</th>
                          <th className="text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.entries.map((e: any) => (
                          <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="text-slate-400 text-[11px]">
                              {new Date(e.timestamp).toLocaleDateString()}
                            </td>
                            <td>
                              <span
                                className={`badge badge-xs text-[10px] font-bold ${
                                  e.type === 'referral_reward'
                                    ? 'badge-warning text-slate-950'
                                    : e.type === 'welcome_bonus'
                                    ? 'badge-success'
                                    : e.type === 'revocation'
                                    ? 'badge-error'
                                    : 'badge-ghost'
                                }`}
                              >
                                {e.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="text-slate-300 text-xs">{e.description}</td>
                            <td
                              className={`text-right font-mono font-bold ${
                                e.points > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {e.points > 0 ? `+${e.points}` : e.points}
                            </td>
                            <td className="text-right font-mono text-slate-300 font-semibold">
                              {e.balanceAfter} pts
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {ledgerPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/80 text-xs text-slate-400">
                        <span>Page {ledgerPagination.page} of {ledgerPagination.totalPages}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => fetchLedger(ledgerPage - 1)}
                            disabled={ledgerPage <= 1 || ledgerLoading}
                            className="btn btn-ghost btn-xs text-xs"
                          >
                            <FiChevronLeft /> Prev
                          </button>
                          <button
                            onClick={() => fetchLedger(ledgerPage + 1)}
                            disabled={ledgerPage >= ledgerPagination.totalPages || ledgerLoading}
                            className="btn btn-ghost btn-xs text-xs"
                          >
                            Next <FiChevronRight />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <FiAward className="text-amber-400" />
                    <span>Referral Leaderboard</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Top participants ranked by qualified referrals and earned points.
                  </p>
                </div>
              </div>

              {lbLoading ? (
                <div className="flex justify-center py-12">
                  <div className="loading loading-spinner loading-md text-amber-400" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <FiAward className="mx-auto text-3xl text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No leaderboard entries yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Be the first to invite a colleague and claim #1 rank!</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                  <table className="table table-xs w-full">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                        <th className="w-16 text-center">Rank</th>
                        <th>User Identifier</th>
                        <th className="text-right">Qualified Referrals</th>
                        <th className="text-right">Total Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((u: any) => {
                        const isGold = u.rank === 1;
                        const isSilver = u.rank === 2;
                        const isBronze = u.rank === 3;
                        return (
                          <tr
                            key={u.rank}
                            className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${
                              isGold ? 'bg-amber-500/10 font-bold' : isSilver ? 'bg-slate-400/5' : isBronze ? 'bg-amber-700/5' : ''
                            }`}
                          >
                            <td className="text-center font-bold">
                              {isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `#${u.rank}`}
                            </td>
                            <td className="text-slate-200 font-medium font-mono">{u.displayName}</td>
                            <td className="text-right font-mono text-emerald-400 font-bold">
                              {u.qualifiedReferrals}
                            </td>
                            <td className="text-right font-mono text-amber-300 font-black">
                              {u.points.toLocaleString()} pts
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination Controls */}
                  {lbPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/80 text-xs text-slate-400">
                      <span>Page {lbPagination.page} of {lbPagination.totalPages}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => fetchLeaderboard(lbPage - 1)}
                          disabled={lbPage <= 1 || lbLoading}
                          className="btn btn-ghost btn-xs text-xs"
                        >
                          <FiChevronLeft /> Prev
                        </button>
                        <button
                          onClick={() => fetchLeaderboard(lbPage + 1)}
                          disabled={lbPage >= lbPagination.totalPages || lbLoading}
                          className="btn btn-ghost btn-xs text-xs"
                        >
                          Next <FiChevronRight />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Privacy Policy Guarantee Notice */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-500 flex items-start gap-2">
                <FiShield className="shrink-0 text-slate-400 mt-0.5" />
                <span>{lbPrivacyPolicy || 'In accordance with PRISM data protection standards, participant names are privacy-masked. Raw emails, user IDs, and payment details are strictly withheld.'}</span>
              </div>
            </div>
          )}

          {/* TAB 4: CAMPAIGN RULES & ELIGIBILITY */}
          {activeTab === 'campaign' && (
            <div className="space-y-5 animate-fade-in text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>{campData.name} ({campData.code || 'LAUNCH2026'})</span>
                  <span className="badge badge-sm badge-success text-[10px] font-bold">Active</span>
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  {campData.description || 'Invite developers and teams to optimize AI workloads and verify smart contracts with PRISM.'}
                </p>
                <div className="pt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
                  <span><strong>Start Date:</strong> {new Date(campData.startDate || Date.now()).toLocaleDateString()}</span>
                  <span><strong>End Date:</strong> {campData.endDate ? new Date(campData.endDate).toLocaleDateString() : 'Ongoing / No Expiration'}</span>
                  <span><strong>Rules Version:</strong> v{campData.rulesVersion || '1.0'}</span>
                </div>
              </div>

              {/* Qualification Rules Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Qualification Criteria & Constraints
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
                    <p className="font-bold text-white">Genuine Paid Task Required</p>
                    <p className="text-slate-400 leading-relaxed">
                      Referral points trigger only when the referred user completes a task with verified on-chain payment.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
                    <p className="font-bold text-white">Minimum Execution Cost</p>
                    <p className="text-slate-400 leading-relaxed">
                      Task execution must have a total cost of at least ${campData.qualificationCriteria?.minTaskCostUSD || '0.01'} USD.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
                    <p className="font-bold text-white">Strict Anti-Fraud Guard</p>
                    <p className="text-slate-400 leading-relaxed">
                      Self-referrals, matching wallet addresses, and duplicate attributions are rejected by database uniqueness.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
                    <p className="font-bold text-white">One Attribution per Referee</p>
                    <p className="text-slate-400 leading-relaxed">
                      Each referred account can have exactly one referrer, permanently locked upon signup or first binding.
                    </p>
                  </div>
                </div>
              </div>

              {/* Crucial Prize Status Notice */}
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
                <FiInfo className="text-indigo-400 text-lg shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-indigo-200">Prize Redemption Notice:</p>
                    <a
                      href="/campaign"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-300 hover:underline font-semibold"
                    >
                      View Dedicated Public Page ↗
                    </a>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Physical prizes and token redemptions are currently disabled for this phase. All points earned are recorded in your append-only ledger and will carry forward to Phase 2 tier rewards and platform benefits.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>PRISM Referral Program • Settled on Algorand</span>
            <span>•</span>
            <a href="/campaign" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-300 underline">
              Campaign Rules Page
            </a>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost text-slate-400 hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
