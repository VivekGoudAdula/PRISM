import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { FiDollarSign, FiZap, FiActivity, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';

export interface TokenSavingsDashboardProps {
  onPeriodChange?: (period: string) => void;
}

export const TokenSavingsDashboard: React.FC<TokenSavingsDashboardProps> = () => {
  const [period, setPeriod] = useState<string>('30d');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSummary = async (p: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/analytics/token-usage/summary?period=${p}`);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load token usage summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(period);
  }, [period]);

  const periods = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="w-full flex flex-col gap-4 mb-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-extrabold text-white tracking-tight">Token Savings &amp; Efficiency</h3>
          <p className="text-xs text-slate-400">Context optimization and AI cost reduction metrics</p>
        </div>

        {/* Time-based period filter */}
        <div className="flex gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                period === p.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Strip */}
      {loading ? (
        <div className="py-8 flex justify-center">
          <span className="loading loading-spinner text-indigo-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <div className="liquid-glass p-4 flex flex-col gap-1 rounded-2xl border border-indigo-500/20">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>Total Tasks</span>
              <FiActivity className="text-indigo-400" />
            </div>
            <span className="text-2xl font-black text-white">{summary?.totalExecutions || 0}</span>
            <span className="text-[10px] text-slate-500">Executions in {period}</span>
          </div>

          <div className="liquid-glass p-4 flex flex-col gap-1 rounded-2xl border border-indigo-500/20">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>Tokens Processed</span>
              <FiZap className="text-sky-400" />
            </div>
            <span className="text-2xl font-black text-white">
              {(summary?.totalTokensProcessed || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Input + Output tokens</span>
          </div>

          <div className="liquid-glass p-4 flex flex-col gap-1 rounded-2xl border border-emerald-500/20">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>Tokens Saved</span>
              <FiTrendingUp className="text-emerald-400" />
            </div>
            <span className="text-2xl font-black text-emerald-400">
              {(summary?.totalTokensSaved || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-400/80 font-bold">
              Avg {(summary?.avgCompressionRatio || 0).toFixed(1)}% reduction
            </span>
          </div>

          <div className="liquid-glass p-4 flex flex-col gap-1 rounded-2xl border border-emerald-500/20">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>AI Cost Saved</span>
              <FiDollarSign className="text-emerald-400" />
            </div>
            <span className="text-2xl font-black text-emerald-400">
              ${(summary?.totalCostSaved || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Saved via Prism optimization
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
export default TokenSavingsDashboard;
