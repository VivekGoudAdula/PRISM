import React, { useState, useEffect, useCallback } from 'react';
import { fetchSemanticCacheHistory } from '../utils/prismApi';
import { FiRefreshCw, FiDatabase, FiZap } from 'react-icons/fi';

/**
 * CacheHistoryPanel
 *
 * Displays real semantic cache history from /api/semantic-cache/history.
 * Shows: Timestamp | Task Type | HIT/MISS | Similarity | Tokens Avoided
 * Uses real API data only — never fabricates values.
 */
const CacheHistoryPanel: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetch cache history from backend */
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSemanticCacheHistory();
      setEntries(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load cache history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiDatabase className="text-sky-400 text-base" />
          <h4 className="text-sm font-extrabold text-white tracking-tight">Semantic Cache History</h4>
        </div>
        <button
          id="cache-history-refresh"
          onClick={fetchHistory}
          disabled={loading}
          className="btn btn-xs btn-ghost text-slate-400 hover:text-white gap-1"
        >
          <FiRefreshCw className={`text-xs ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-6 flex justify-center">
          <span className="loading loading-spinner text-indigo-400" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-slate-500 text-xs">
          <FiZap className="text-2xl text-slate-700 mx-auto mb-2" />
          <p>No semantic cache entries yet.</p>
          <p className="text-[10px] text-slate-600 mt-1">Cache entries appear after the first task execution.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Timestamp</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Task Type</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Similarity</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tokens Avoided</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const hitCount: number = entry.hitCount ?? 0;
                const isHit = hitCount > 0;
                const similarity: number = entry.metadata?.lastSimilarity ?? 0;
                const tokensAvoided: number = isHit
                  ? (entry.tokenEstimate ?? 0)
                  : 0;
                const timestamp = entry.lastUsedAt || entry.createdAt;
                return (
                  <tr
                    key={entry._id || idx}
                    className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">
                      {timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-950/50 border border-indigo-900/50 text-indigo-300 text-[10px] font-bold uppercase">
                        {(entry.taskType || 'general').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isHit
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
                      }`}>
                        {isHit ? `✓ HIT (${hitCount}×)` : '⚡ MISS'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-300">
                      {similarity > 0 ? `${(similarity * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-extrabold text-emerald-400">
                      {isHit && tokensAvoided > 0 ? tokensAvoided.toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CacheHistoryPanel;
