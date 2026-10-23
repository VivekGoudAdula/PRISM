import React, { useState, useEffect } from 'react';
import {
  FiUsers,
  FiAward,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiEdit2,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import { api } from '../utils/api';

export const AdminReferralsPanel: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Campaign edit state
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [campForm, setCampForm] = useState({
    name: '',
    referrerPoints: 5,
    refereePoints: 10,
    description: '',
    isActive: true,
    endDate: '',
    maxReferralsPerUser: 0,
    totalCampaignBudgetPoints: 0,
  });
  const [savingCampaign, setSavingCampaign] = useState<boolean>(false);

  // Review modal state
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewReason, setReviewReason] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/admin/referrals/overview');
      setOverview(data);
      if (data?.campaigns?.length > 0) {
        const active = data.campaigns.find((c: any) => c.isActive) || data.campaigns[0];
        setEditingCampaign(active);
        setCampForm({
          name: active.name || '',
          referrerPoints: active.referrerPoints ?? active.rewards?.referrerPoints ?? 5,
          refereePoints: active.refereePoints ?? active.rewards?.refereePoints ?? 10,
          description: active.description || '',
          isActive: Boolean(active.isActive),
          endDate: active.endDate ? new Date(active.endDate).toISOString().split('T')[0] : '',
          maxReferralsPerUser: active.limits?.maxReferralsPerUser ?? 0,
          totalCampaignBudgetPoints: active.limits?.totalCampaignBudgetPoints ?? 0,
        });
      }
    } catch (err: any) {
      console.error('Failed to load admin referrals overview:', err);
      setError('Failed to fetch referral metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    setSavingCampaign(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload: any = {
        name: campForm.name.trim(),
        referrerPoints: Number(campForm.referrerPoints),
        refereePoints: Number(campForm.refereePoints),
        description: campForm.description.trim(),
        isActive: campForm.isActive,
        endDate: campForm.endDate ? new Date(campForm.endDate).toISOString() : null,
        limits: {
          maxReferralsPerUser: Number(campForm.maxReferralsPerUser),
          totalCampaignBudgetPoints: Number(campForm.totalCampaignBudgetPoints),
        },
      };

      const { data } = await api.patch(`/api/admin/referrals/campaigns/${editingCampaign._id}`, payload);
      if (data?.success) {
        setSuccessMsg('Campaign parameters updated successfully with audit trail.');
        setEditingCampaign(data.campaign);
        fetchOverview();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update campaign.');
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleExecuteReview = async () => {
    if (!reviewItem) return;
    if (reviewReason.trim().length < 5) {
      setError('A documented reason of at least 5 characters is required for the audit log.');
      return;
    }
    setSubmittingReview(true);
    setError('');
    try {
      const { data } = await api.post(`/api/admin/referrals/${reviewItem.id}/review`, {
        action: reviewAction,
        reason: reviewReason.trim(),
      });
      if (data?.success) {
        setSuccessMsg(`Attribution ${reviewAction}ed successfully. Audit log and points ledger updated.`);
        setReviewItem(null);
        setReviewReason('');
        fetchOverview();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to review attribution.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const summary = overview?.summary || {
    totalAttributions: 0,
    pendingAttributions: 0,
    qualifiedAttributions: 0,
    rejectedAttributions: 0,
    totalPointsAwarded: 0,
  };

  const conversionRate = summary.totalAttributions > 0
    ? ((summary.qualifiedAttributions / summary.totalAttributions) * 100).toFixed(1)
    : '0.0';

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 w-full text-slate-400">
        <div className="loading loading-spinner loading-md text-indigo-400 mb-2" />
        <p className="text-xs">Loading Referral Administration metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-fade-in text-slate-200">
      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">
            <FiX />
          </button>
        </div>
      )}

      {/* Top Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Referral Program Administration
            <span className="badge badge-sm badge-primary text-[10px] font-bold">Admin Portal</span>
          </h2>
          <p className="text-xs text-slate-400">
            Audit attributions, review pending disputes, and configure reward campaigns.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="btn btn-sm btn-ghost border border-slate-700/80 rounded-xl text-xs font-semibold gap-1.5"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Total Referrals</span>
          <span className="text-2xl font-black text-white mt-1">{summary.totalAttributions}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Attributed signups</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Qualified</span>
          <span className="text-2xl font-black text-emerald-400 mt-1">{summary.qualifiedAttributions}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">{conversionRate}% conversion rate</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Pending Tasks</span>
          <span className="text-2xl font-black text-amber-400 mt-1">{summary.pendingAttributions}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Awaiting first task</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Rejected / Fraud</span>
          <span className="text-2xl font-black text-rose-400 mt-1">{summary.rejectedAttributions}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Disqualified entries</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium">Total Points Issued</span>
          <span className="text-2xl font-black text-indigo-400 mt-1">
            {summary.totalPointsAwarded.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">Append-only ledger sum</span>
        </div>
      </div>

      {/* Campaign Configuration Editor */}
      {editingCampaign && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <FiEdit2 className="text-indigo-400 text-sm" />
              <h3 className="text-sm font-bold text-white">Active Campaign: {editingCampaign.code}</h3>
            </div>
            <span className={`badge badge-sm text-[10px] font-bold ${editingCampaign.isActive ? 'badge-success' : 'badge-ghost'}`}>
              {editingCampaign.isActive ? 'Active' : 'Disabled'}
            </span>
          </div>

          <form onSubmit={handleSaveCampaign} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={campForm.name}
                  onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
                  className="input input-sm w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Referrer Reward Points</label>
                <input
                  type="number"
                  min="0"
                  value={campForm.referrerPoints}
                  onChange={(e) => setCampForm({ ...campForm, referrerPoints: Number(e.target.value) })}
                  className="input input-sm w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Referee Welcome Points</label>
                <input
                  type="number"
                  min="0"
                  value={campForm.refereePoints}
                  onChange={(e) => setCampForm({ ...campForm, refereePoints: Number(e.target.value) })}
                  className="input input-sm w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Max Referrals / User (0 = uncapped)</label>
                <input
                  type="number"
                  min="0"
                  value={campForm.maxReferralsPerUser}
                  onChange={(e) => setCampForm({ ...campForm, maxReferralsPerUser: Number(e.target.value) })}
                  className="input input-sm w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Total Campaign Budget Points (0 = uncapped)</label>
                <input
                  type="number"
                  min="0"
                  value={campForm.totalCampaignBudgetPoints}
                  onChange={(e) => setCampForm({ ...campForm, totalCampaignBudgetPoints: Number(e.target.value) })}
                  className="input input-sm w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  value={campForm.endDate}
                  onChange={(e) => setCampForm({ ...campForm, endDate: e.target.value })}
                  className="input input-sm w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={campForm.isActive}
                    onChange={(e) => setCampForm({ ...campForm, isActive: e.target.checked })}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  <span>Campaign Active</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Description & Terms Summary</label>
              <textarea
                value={campForm.description}
                onChange={(e) => setCampForm({ ...campForm, description: e.target.value })}
                rows={2}
                placeholder="Campaign rules and qualification details"
                className="textarea textarea-sm w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingCampaign}
                className="btn btn-sm btn-primary rounded-lg text-xs font-bold gap-1 px-5"
              >
                {savingCampaign ? <span className="loading loading-spinner loading-xs" /> : <FiCheck />}
                <span>Save Campaign Rules</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Attributions Table with Review Actions */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FiUsers className="text-indigo-400" />
              <span>Recent Referral Attributions</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Audit log of referred users and manual approval/dispute controls.
            </p>
          </div>
          <span className="text-xs text-slate-500">{overview?.recentAttributions?.length || 0} loaded</span>
        </div>

        {(!overview?.recentAttributions || overview.recentAttributions.length === 0) ? (
          <p className="text-center py-8 text-xs text-slate-500">No attributions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="table table-xs w-full">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th>Referrer</th>
                  <th>Referred User (Referee)</th>
                  <th>Code Used</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Client IP</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentAttributions.map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td>
                      <div>
                        <p className="font-semibold text-slate-200 text-xs">{a.referrer?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{a.referrer?.email || a.referrer?.wallet?.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-semibold text-slate-200 text-xs">{a.referee?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{a.referee?.email || a.referee?.wallet?.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td className="font-mono text-xs font-bold text-indigo-400">{a.referralCodeUsed}</td>
                    <td className="text-slate-400 text-[11px]">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span
                        className={`badge badge-xs text-[10px] font-bold ${
                          a.status === 'qualified'
                            ? 'badge-success'
                            : a.status === 'pending'
                            ? 'badge-warning'
                            : 'badge-error'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="font-mono text-[10px] text-slate-500">{a.clientIp || '127.0.0.1'}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {a.status !== 'qualified' && (
                          <button
                            onClick={() => {
                              setReviewItem(a);
                              setReviewAction('approve');
                              setReviewReason('');
                            }}
                            className="btn btn-xs btn-outline btn-success text-[10px]"
                          >
                            Approve
                          </button>
                        )}
                        {a.status !== 'rejected' && (
                          <button
                            onClick={() => {
                              setReviewItem(a);
                              setReviewAction('reject');
                              setReviewReason('');
                            }}
                            className="btn btn-xs btn-outline btn-error text-[10px]"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal Dialog */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FiShield className="text-indigo-400" />
              <span>Review Attribution ({reviewAction.toUpperCase()})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Referrer: <strong className="text-white">{reviewItem.referrer?.name}</strong> • Referee:{' '}
              <strong className="text-white">{reviewItem.referee?.name}</strong>
            </p>

            {/* Strict Invariant Warning */}
            {reviewAction === 'approve' ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                <p className="font-bold">🔒 Anti-Fabrication Security Invariant:</p>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Approving requires the referee to have completed a genuine Algorand x402-settled paid AI task. If no genuine on-chain payment exists, the server strictly blocks fabrication with HTTP 400.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                <p className="font-bold">⚠️ Compensating Ledger Revocation:</p>
                <p className="text-[11px] text-rose-200/80 leading-relaxed">
                  Rejecting will transition the status to rejected and issue an immutable compensating ledger debit if reward points were previously credited.
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-400">
                  Reason / Investigation Notes (Min 5 chars)
                </label>
                <span className={`text-[10px] font-mono ${reviewReason.trim().length >= 5 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {reviewReason.trim().length}/5 min
                </span>
              </div>
              <textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="e.g. Verified genuine account or Sybil cluster detected"
                className="textarea textarea-sm w-full bg-slate-950 border border-slate-700 text-xs rounded-xl"
                rows={3}
              />
              {reviewReason.trim().length > 0 && reviewReason.trim().length < 5 && (
                <p className="text-[10px] text-rose-400 mt-1">
                  A documented reason of at least 5 characters is required for the audit log.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewItem(null)}
                disabled={submittingReview}
                className="btn btn-sm btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReview}
                disabled={submittingReview || reviewReason.trim().length < 5}
                className={`btn btn-sm text-xs font-bold ${
                  reviewAction === 'approve' ? 'btn-success' : 'btn-error'
                }`}
              >
                {submittingReview ? <span className="loading loading-spinner loading-xs" /> : null}
                <span>Confirm {reviewAction === 'approve' ? 'Approval' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
