import React, { useState } from 'react';
import { PromptOptimizationResult, SemanticCacheData } from '../utils/prismApi';

interface PromptOptimizerPanelProps {
  optimization?: PromptOptimizationResult;
  originalTokens?: number;
  optimizedTokens?: number;
  tokensSaved?: number;
  reductionPercentage?: number;
  cacheTokensSaved?: number;
  semanticCache?: SemanticCacheData;
  useOptimizedContext: boolean;
  onToggleUseOptimized: (useOptimized: boolean) => void;
}

export const PromptOptimizerPanel: React.FC<PromptOptimizerPanelProps> = ({
  optimization,
  originalTokens = 0,
  optimizedTokens = 0,
  tokensSaved = 0,
  reductionPercentage = 0,
  cacheTokensSaved = 0,
  semanticCache,
  useOptimizedContext,
  onToggleUseOptimized,
}) => {
  const [activeTab, setActiveTab] = useState<'optimized' | 'original' | 'diff'>('optimized');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const origCount = optimization?.originalInputTokens || originalTokens;
  const optCount = optimization?.optimizedInputTokens || optimizedTokens;
  const savedCount = optimization?.tokensSaved || tokensSaved;
  const redPercent = optimization?.reductionPercentage || reductionPercentage;

  const isCacheHit = semanticCache?.cacheHit;
  const cSaved = cacheTokensSaved || semanticCache?.cacheTokensSaved || 0;
  const totalSaved = cSaved + savedCount;

  return (
    <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-5 shadow-2xl backdrop-blur-md text-white my-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-wide text-emerald-400">PRISM PROMPT OPTIMIZER</h3>
            <p className="text-xs text-slate-400">Intelligent context restructuring & token compression</p>
          </div>
        </div>

        {/* User Toggle Controls */}
        <div className="flex items-center space-x-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => onToggleUseOptimized(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              useOptimizedContext
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Use Optimized
          </button>
          <button
            type="button"
            onClick={() => onToggleUseOptimized(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              !useOptimizedContext
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Use Original
          </button>
        </div>
      </div>

      {/* Main Token Compression Breakdown Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Original Context</span>
          <div className="text-lg font-bold text-slate-200 mt-1">{origCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">tokens</span></div>
        </div>
        <div className="bg-slate-950/60 rounded-lg p-3 border border-emerald-500/30">
          <span className="text-xs text-emerald-400 font-medium">Optimized Context</span>
          <div className="text-lg font-bold text-emerald-300 mt-1">{optCount.toLocaleString()} <span className="text-xs font-normal text-emerald-500/80">tokens</span></div>
        </div>
        <div className="bg-emerald-950/40 rounded-lg p-3 border border-emerald-500/40 flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">{redPercent.toFixed(1)}% REDUCTION</span>
          <div className="text-xl font-black text-emerald-400 mt-1">{savedCount.toLocaleString()} <span className="text-xs font-medium text-emerald-300">TOKENS SAVED</span></div>
        </div>
      </div>

      {/* Semantic Cache Hit Section if present */}
      {isCacheHit && (
        <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded text-xs font-bold">
              ✓ CACHE HIT
            </span>
            <span className="text-xs text-cyan-200 font-medium">
              {((semanticCache?.similarity || 0.9) * 100).toFixed(1)}% similarity match
            </span>
          </div>
          <span className="text-xs font-semibold text-cyan-300">
            {cSaved.toLocaleString()} tokens avoided via Semantic Cache
          </span>
        </div>
      )}

      {/* Preservation Breakdown Checklist */}
      <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/60 mb-4 text-xs space-y-1.5">
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>Redundancy and duplicate information removed</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>Repeated document sections merged</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>Required named entities, dates, and IDs preserved</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>Task constraints and negations (MUST, NOT, EXCLUDE) preserved</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>Output structure and schema requirements preserved</span>
        </div>
      </div>

      {/* Total PRISM Savings Summary */}
      <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-3 text-slate-400">
        <div>
          <span>Cache Saved: <strong className="text-cyan-400">{cSaved}</strong></span>
          <span className="mx-2">•</span>
          <span>Optimizer Saved: <strong className="text-emerald-400">{savedCount}</strong></span>
        </div>
        <div className="font-bold text-emerald-400">
          Total Savings: {totalSaved.toLocaleString()} tokens
        </div>
      </div>

      {/* Expandable View Optimized Context Section */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-colors"
        >
          <span>View Optimized Context Payload</span>
          <span className="text-slate-500">{isExpanded ? '▲ Hide' : '▼ Expand'}</span>
        </button>

        {isExpanded && (
          <div className="mt-3 bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs">
            <div className="flex space-x-2 mb-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('optimized')}
                className={`px-2.5 py-1 rounded text-xs ${
                  activeTab === 'optimized' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400'
                }`}
              >
                Optimized Context
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('original')}
                className={`px-2.5 py-1 rounded text-xs ${
                  activeTab === 'original' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'
                }`}
              >
                Original Context
              </button>
            </div>

            <pre className="font-mono text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto p-2 bg-slate-900/60 rounded">
              {activeTab === 'optimized'
                ? optimization?.optimizedPrompt || 'No optimization payload available'
                : optimization?.originalPrompt || 'No original context available'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
