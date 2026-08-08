import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { FiDatabase, FiZap, FiCheckCircle, FiX } from 'react-icons/fi';

export interface TokenAnalysisModalProps {
  task: any;
  onClose: () => void;
}

/**
 * Detailed Token Analysis Modal.
 *
 * Clearly separates:
 *  1. Data Map / context compression savings (raw → structured map tokens)
 *  2. Semantic Cache savings (context avoided/reused from a cached entry)
 *
 * Does NOT add the two savings together.
 */
export const TokenAnalysisModal: React.FC<TokenAnalysisModalProps> = ({ task, onClose }) => {
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTokenUsage = async () => {
      try {
        const { data } = await api.get(`/api/analytics/token-usage/task/${task._id}`);
        setTokenData(data);
      } catch {
        // Graceful fallback using planner-level values if API unavailable
        const orig = task.plannerOutput?.originalInputTokens || 0;
        const opt = task.plannerOutput?.optimizedInputTokens || orig;
        const saved = Math.max(0, orig - opt);
        const ratio = orig > 0 ? (saved / orig) * 100 : 0;
        setTokenData({
          originalInputTokens: orig,
          optimizedInputTokens: opt,
          outputTokens: 0,
          totalTokens: opt,
          tokensSaved: saved,
          compressionRatio: ratio,
          estimatedOriginalCost: 0,
          optimizedCost: 0,
          costSaved: 0,
          cacheHit: false,
          cacheStatus: 'miss',
          cachedContextTokens: 0,
          cacheTokensSaved: 0,
          cacheSimilarity: 0,
          cacheEntryId: '',
          measurementSource: 'estimated',
        });
      } finally {
        setLoading(false);
      }
    };
    if (task) loadTokenUsage();
  }, [task]);

  if (!task) return null;

  // Resolve semantic cache values — prefer live tokenData fields, fall back to task response body
  const sc = task?.semanticCache;
  const isHit: boolean = tokenData?.cacheHit || sc?.cacheHit || sc?.cacheStatus === 'hit' || false;
  const similarity: number = sc?.similarity ?? tokenData?.cacheSimilarity ?? 0;
  const cachedCtxTokens: number = sc?.cachedContextTokens ?? tokenData?.cachedContextTokens ?? 0;
  const tokensAvoided: number = sc?.cacheTokensSaved ?? tokenData?.cacheTokensSaved ?? 0;
  const cacheEntryId: string = sc?.cacheEntryId || tokenData?.cacheEntryId || 'N/A';
  const lastUsedAt: string | null = sc?.lastUsedAt || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,4,18,0.92)', backdropFilter: 'blur(12px)' }}
    >
      <div className="w-full max-w-lg rounded-3xl border border-indigo-500/25 bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-white shadow-2xl flex flex-col gap-4 animate-scale-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-3 shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-indigo-300 uppercase tracking-wide">
              Detailed Token Analysis
            </h3>
            <p className="text-xs text-slate-400 font-mono truncate max-w-[320px] mt-0.5">{task.prompt}</p>
          </div>
          <button
            id="token-analysis-close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
          >
            <FiX />
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <span className="loading loading-spinner text-indigo-400" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-xs">

            {/* ─── Section 1: Context & Tokens ───────────────────────────── */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                <FiDatabase className="text-xs" /> Context &amp; Tokens
              </span>
              <div className="flex justify-between">
                <span className="text-slate-400">Original Input</span>
                <span className="font-mono font-bold">{(tokenData?.originalInputTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Optimized Input</span>
                <span className="font-mono font-bold text-indigo-300">{(tokenData?.optimizedInputTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Output Tokens</span>
                <span className="font-mono font-bold">{(tokenData?.outputTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-extrabold text-sm">
                <span>Total Processed</span>
                <span className="font-mono">{(tokenData?.totalTokens ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* ─── Section 2: Data Map Compression Savings ──────────────── */}
            <div className="bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/25 flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                Data Map Compression
              </span>
              <p className="text-[10px] text-slate-500 italic">
                Raw document tokens → structured semantic map tokens (context compression)
              </p>
              <div className="flex justify-between">
                <span className="text-slate-400">Raw Input Tokens</span>
                <span className="font-mono font-bold text-slate-300">{(tokenData?.originalInputTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Map Context Tokens</span>
                <span className="font-mono font-bold text-indigo-300">{(tokenData?.optimizedInputTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tokens Saved</span>
                <span className="font-mono font-extrabold text-emerald-300">{(tokenData?.tokensSaved ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Compression</span>
                <span className="font-mono font-extrabold text-emerald-300">{(tokenData?.compressionRatio ?? 0).toFixed(1)}%</span>
              </div>
              <div className="border-t border-indigo-900/30 pt-2 flex justify-between text-[11px]">
                <span className="text-slate-400">Estimated AI Cost Saved</span>
                <span className="font-mono font-extrabold text-emerald-400">${(tokenData?.costSaved ?? 0).toFixed(4)}</span>
              </div>
            </div>

            {/* ─── Section 3: Semantic Cache ────────────────────────────── */}
            <div className={`p-4 rounded-2xl border flex flex-col gap-2 transition-all ${
              isHit
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
                  <FiZap className="text-xs" /> Semantic Cache
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isHit
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {isHit ? '✓ CACHE HIT' : '⚡ CACHE MISS'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                Context that was avoided/reused because an existing semantic representation was found
              </p>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Cache Status</span>
                <span className={`font-mono font-bold uppercase ${isHit ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {isHit ? 'HIT' : 'MISS'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Similarity Score</span>
                <span className="font-mono font-extrabold text-indigo-300">
                  {similarity > 0 ? `${(similarity * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Original Context Tokens</span>
                <span className="font-mono font-bold text-slate-300">
                  {tokenData?.originalInputTokens > 0 ? tokenData.originalInputTokens.toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Cached Context Tokens</span>
                <span className="font-mono font-bold text-sky-300">
                  {cachedCtxTokens > 0 ? cachedCtxTokens.toLocaleString() : isHit ? cachedCtxTokens.toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Tokens Avoided (Cache)</span>
                <span className={`font-mono font-extrabold ${isHit ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isHit ? tokensAvoided.toLocaleString() : '0'}
                </span>
              </div>

              {cacheEntryId && cacheEntryId !== 'N/A' && (
                <div className="flex justify-between items-center border-t border-slate-800/40 pt-2">
                  <span className="text-slate-500">Cache Entry ID</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {cacheEntryId.slice(0, 8)}…{cacheEntryId.slice(-6)}
                  </span>
                </div>
              )}
              {lastUsedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cache Timestamp</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(lastUsedAt).toLocaleString()}
                  </span>
                </div>
              )}

              {!isHit && (
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50 text-[11px] text-slate-400 mt-1">
                  No reusable semantic context matched this request. A new cache entry has been stored for future similar requests.
                </div>
              )}
            </div>

            {/* ─── Section 4: AI Cost Breakdown ────────────────────────── */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                <FiCheckCircle className="text-xs" /> Estimated AI Cost
              </span>
              <div className="flex justify-between">
                <span className="text-slate-400">Without Prism</span>
                <span className="font-mono font-bold text-slate-400">${(tokenData?.estimatedOriginalCost ?? 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">With Prism</span>
                <span className="font-mono font-bold text-emerald-400">${(tokenData?.optimizedCost ?? 0).toFixed(4)}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-extrabold text-sm">
                <span>Saved</span>
                <span className="font-mono text-emerald-300">${(tokenData?.costSaved ?? 0).toFixed(4)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
              <span>Semantic Cache: {isHit ? 'Used ✓' : 'Not used'}</span>
              <span className="capitalize font-mono">Measurement: {tokenData?.measurementSource || 'estimated'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TokenAnalysisModal;
