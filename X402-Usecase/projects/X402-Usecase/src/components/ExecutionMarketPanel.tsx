import React, { useState, useEffect } from 'react';
import { FiZap, FiCpu, FiCheckCircle, FiShield } from 'react-icons/fi';
import type { ExecutionPlan } from '../utils/prismApi';

export interface ExecutionMarketPanelProps {
  plan: ExecutionPlan;
  execProgress: {
    current: number;
    total: number;
    category: string;
    phase: 'payment' | 'executing' | 'verifying' | 'completed';
    currentFilename?: string;
  } | null;
  paymentStatus: string;
}

const categoryLabel: Record<string, string> = {
  resume_screening: 'Resume Screening',
  contract_analysis: 'Contract Analysis',
  invoice_extraction: 'Invoice Extraction',
  code_review: 'Code Review',
  seo_audit: 'SEO Audit',
  news_research: 'News Research',
  source_comparison: 'Source Comparison',
  claim_verification: 'Claim Verification',
  claim_extraction: 'Claim Extraction',
};

export const ExecutionMarketPanel: React.FC<ExecutionMarketPanelProps> = ({
  plan,
  execProgress,
  paymentStatus,
}) => {
  // Progression state: 'market' -> 'optimizing' -> 'paying' -> 'settling' -> 'verified'
  const [stage, setStage] = useState<'market' | 'optimizing' | 'paying' | 'settling' | 'verified'>('market');

  useEffect(() => {
    // Sequence starts automatically. Wait a bit for visual flair, then advance to optimizing.
    // 'paying' is triggered externally by execProgress.
    let timer: NodeJS.Timeout;
    if (stage === 'market') {
      timer = setTimeout(() => setStage('optimizing'), 800);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [stage]);

  useEffect(() => {
    if (execProgress) {
      if (execProgress.phase === 'payment') setStage('paying');
      else if (execProgress.phase === 'executing' || execProgress.phase === 'verifying') setStage('settling');
      else if (execProgress.phase === 'completed') setStage('verified');
    }
  }, [execProgress]);

  const activeCategory = categoryLabel[plan.category] ?? plan.category;
  
  const baseTotal = plan.baseTotal ?? plan.basePrice ?? plan.unitPrice;
  const totalSavings = plan.totalOptimizationDiscount ?? plan.optimizationDiscount ?? 0;
  const finalTotal = plan.finalTotal ?? plan.totalCost;

  // Fix candidate pricing display: scale static prices by the actual dynamic base price
  const winnerCandidate = (plan.candidates || []).find(c => c.endpoint_path === plan.endpointPath);
  const winnerStaticPrice = winnerCandidate?.price || 0.01;

  const getCandidateLabel = (endpoint: string) => {
    if (endpoint.includes('-fast')) return '⚡ FAST';
    if (endpoint.includes('-accurate')) return '◈ ACCURATE';
    return 'STANDARD';
  };

  const getCandidateDesc = (endpoint: string) => {
    if (endpoint.includes('-fast')) return 'Lower latency · Standard analysis';
    if (endpoint.includes('-accurate')) return 'Deeper analysis · Higher processing';
    return 'Standard execution';
  };

  // Build the execution timeline dynamically based on current state
  const timelineSteps = [
    { label: 'TASK UNDERSTOOD', detail: activeCategory, done: true },
    { label: 'CAPABILITIES EVALUATED', detail: 'Fast · Accurate', done: true },
    { label: 'EXECUTION SELECTED', detail: plan.providerName || plan.endpointPath, done: stage !== 'market' },
    { label: 'PRISM OPTIMIZATION', detail: 'Data Map · Semantic Cache · Prompt Optimizer', done: stage === 'paying' || stage === 'settling' || stage === 'verified' },
    { label: 'x402 PAYMENT', detail: stage === 'paying' ? 'Awaiting signature...' : 'Verified', done: stage === 'settling' || stage === 'verified', active: stage === 'paying' },
    { label: 'ALGORAND SETTLEMENT', detail: stage === 'settling' ? paymentStatus || 'Executing capability via smart contract...' : 'Confirmed', done: stage === 'verified', active: stage === 'settling' },
    { label: 'VERIFIED RESULT', detail: stage === 'verified' ? 'Result generated' : 'Pending', done: stage === 'verified' }
  ];

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 mb-8 mt-2 animate-fade-in">
      
      {/* LEFT COLUMN: The Timeline */}
      <div className="w-full md:w-1/3 flex flex-col justify-start">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl">
          <div className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-4 border-b border-slate-800/80 pb-2">
            Execution Timeline
          </div>
          <div className="flex flex-col gap-0 relative">
            {/* Connecting line */}
            <div className="absolute left-[11px] top-4 bottom-4 w-px bg-slate-800/80 z-0"></div>
            
            {timelineSteps.map((step, idx) => (
              <div key={idx} className="flex gap-4 items-start relative z-10 py-3">
                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border text-[10px] bg-slate-950
                  ${step.done ? 'border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                    : step.active ? 'border-indigo-500/50 text-indigo-400 animate-pulse' 
                    : 'border-slate-800 text-slate-600'}`
                }>
                  {step.done ? <FiCheckCircle /> : (step.active ? '...' : idx + 1)}
                </div>
                <div className="flex flex-col -mt-0.5">
                  <span className={`text-xs font-bold uppercase ${step.done ? 'text-slate-300' : step.active ? 'text-indigo-300' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">{step.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: The Details */}
      <div className="w-full md:w-2/3 flex flex-col gap-4">
        
        {/* EXECUTION MARKET VISUALIZATION */}
        <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 rounded-2xl border border-slate-800/80 p-5 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow based on state */}
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-10 pointer-events-none
            ${stage === 'market' ? 'bg-indigo-500' : stage === 'verified' ? 'bg-emerald-500' : 'bg-indigo-500'}`
          }></div>

          <div className="flex items-center gap-2 mb-1">
            <FiZap className="text-indigo-400 text-sm" />
            <h2 className="text-sm font-bold text-white tracking-tight uppercase">EXECUTION MARKET</h2>
          </div>
          <p className="text-[10px] text-slate-400 mb-5">Relevant execution paths evaluated by PRISM</p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {(plan.candidates || []).map((candidate, idx) => {
              const isSelected = plan.endpointPath === candidate.endpoint_path;
              // Scale the candidate static price to the actual dynamic base total so math makes sense
              const candidateActualBasePrice = (candidate.price / winnerStaticPrice) * baseTotal;

              return (
                <div key={idx} className={`flex-1 flex flex-col p-4 rounded-xl border transition-all duration-700
                  ${isSelected ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.05)] -translate-y-1' 
                  : 'border-slate-800/60 bg-slate-900/40 opacity-60'}`
                }>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">{activeCategory}</div>
                  <div className={`text-base font-black mt-1 ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {getCandidateLabel(candidate.endpoint_path)}
                  </div>
                  <div className="text-sm font-mono text-slate-300 mt-1">${candidateActualBasePrice.toFixed(4)}</div>
                  <div className="text-[10px] text-slate-500 mt-2 mb-4 leading-relaxed">{getCandidateDesc(candidate.endpoint_path)}</div>
                  <div className="mt-auto">
                    <div className={`text-[10px] font-black px-2 py-1 rounded-md inline-block uppercase tracking-wider
                      ${isSelected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'}`
                    }>
                      {isSelected ? '✓ SELECTED' : 'AVAILABLE'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* PRISM OPTIMIZATION & PRICING (appears after market evaluation) */}
        {(stage !== 'market') && (
          <div className="animate-fade-in bg-gradient-to-b from-indigo-950/20 to-slate-950/60 rounded-2xl border border-indigo-500/20 p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-1.5 pb-2 border-b border-indigo-500/10">
              <FiCpu className="text-indigo-400 text-sm" />
              <span className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider">PRISM OPTIMIZATION</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Metrics */}
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div className="flex justify-between items-center col-span-2">
                   <span className="text-slate-400">Original request</span>
                   <span className="font-mono text-slate-300">{plan.originalInputTokens || 0} tokens</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                   <span className="text-slate-400">Semantic Cache</span>
                   <span className={`font-black uppercase ${plan.semanticCache?.cacheHit ? 'text-emerald-400' : 'text-slate-500'}`}>
                     {plan.semanticCache?.cacheHit ? 'HIT' : 'MISS'}
                   </span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                   <span className="text-slate-400">Tokens saved</span>
                   <span className="font-mono text-emerald-400">{plan.totalTokensSaved || 0}</span>
                </div>
                <div className="flex justify-between items-center col-span-2">
                   <span className="text-slate-400">Prompt Optimizer</span>
                   <span className={`font-black uppercase ${plan.optimizationApplied ? 'text-emerald-400' : 'text-slate-500'}`}>
                     {plan.optimizationApplied ? 'APPLIED' : 'BYPASSED'}
                   </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800/80 pt-3 mt-1 col-span-2">
                   <span className="text-slate-300 font-bold">Final execution input</span>
                   <span className="font-mono text-indigo-300 font-bold">{plan.optimizedInputTokens || 0} tokens</span>
                </div>
              </div>

              {/* Pricing Math */}
              <div className="flex-1 flex flex-col justify-center gap-3 bg-slate-900/50 rounded-xl p-4 border border-slate-800/50">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 uppercase font-bold tracking-wider">BASE PRICE</span>
                  <span className="font-mono text-slate-300">${baseTotal.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 uppercase font-bold tracking-wider">OPTIMIZATION</span>
                  <span className="font-mono text-emerald-400">-${totalSavings.toFixed(4)}</span>
                </div>
                <div className="border-t border-slate-700/50 my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="text-white uppercase font-black tracking-wider text-xs">FINAL x402</span>
                  <span className="font-mono text-emerald-400 font-black text-sm">${finalTotal.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ExecutionMarketPanel;
