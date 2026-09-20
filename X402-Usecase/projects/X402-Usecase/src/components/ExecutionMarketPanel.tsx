import React, { useState, useEffect } from 'react';
import { FiZap, FiCpu, FiCheckCircle, FiDollarSign, FiShield } from 'react-icons/fi';
import type { ExecutionPlan, AttachedFile, PaymentPreviewItem } from '../utils/prismApi';

export interface ExecutionMarketPanelProps {
  plan: ExecutionPlan;
  files: AttachedFile[];
  onConfirm: (filteredFiles: AttachedFile[], updatedPlan: ExecutionPlan) => void;
  onCancel: () => void;
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
  files,
  onConfirm,
  onCancel,
  execProgress,
  paymentStatus,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(
      files.length > 0
        ? files.map((_, i) => i)
        : Array.from({ length: plan.executionQuantity }, (_, i) => i)
    )
  );
  
  // Progression state: 'market' -> 'optimizing' -> 'ready' -> 'paying' -> 'settling' -> 'verified'
  const [stage, setStage] = useState<'market' | 'optimizing' | 'ready' | 'paying' | 'settling' | 'verified'>('market');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (stage === 'market') {
      timer = setTimeout(() => setStage('optimizing'), 800);
    } else if (stage === 'optimizing') {
      timer = setTimeout(() => setStage('ready'), 1200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [stage]);

  useEffect(() => {
    // React to external execution progress from PrismConsole
    if (execProgress) {
      if (execProgress.phase === 'payment') setStage('paying');
      else if (execProgress.phase === 'executing' || execProgress.phase === 'verifying') setStage('settling');
      else if (execProgress.phase === 'completed') setStage('verified');
    }
  }, [execProgress]);

  const selectedCount = selectedIndices.size;
  const executionCost = selectedCount * plan.unitPrice;
  const totalCost = selectedCount > 0 ? executionCost + plan.platformFee : 0;
  
  const baseTotal = plan.baseTotal ?? ((plan.basePrice ?? plan.unitPrice) * selectedCount);
  const totalSavings = plan.totalOptimizationDiscount ?? ((plan.optimizationDiscount ?? 0) * selectedCount);
  const finalTotal = totalCost;

  const handleConfirm = () => {
    if (selectedCount === 0) return;
    const filteredFiles = files.filter((_, idx) => selectedIndices.has(idx));
    const updatedPlan: ExecutionPlan = {
      ...plan,
      executionQuantity: selectedCount,
      executionCost: executionCost,
      totalCost: totalCost,
      uploadedFiles: (plan as any).uploadedFiles
        ? (plan as any).uploadedFiles.filter((item: any) => selectedIndices.has(item.index))
        : undefined,
      files: (plan as any).files
        ? (plan as any).files.filter((_: any, idx: number) => selectedIndices.has(idx))
        : undefined,
      pages: (plan as any).pages
        ? (plan as any).pages.filter((_: any, idx: number) => selectedIndices.has(idx))
        : undefined,
    };
    onConfirm(filteredFiles, updatedPlan);
  };

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

  const activeCategory = categoryLabel[plan.category] ?? plan.category;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 my-auto overflow-hidden"
      style={{ background: 'rgba(2,4,18,0.88)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="w-full max-w-2xl animate-scale-up rounded-3xl border border-indigo-500/20 shadow-2xl flex flex-col"
        style={{
          maxHeight: '92vh',
          background: 'linear-gradient(135deg, rgba(15,18,45,0.99) 0%, rgba(8,12,30,0.99) 100%)',
          boxShadow: '0 0 80px rgba(99,102,241,0.15), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        <div className="px-5 py-3 border-b border-white/5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <FiZap className="text-indigo-400 text-xs" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">EXECUTION MARKET</h2>
              <p className="text-[10px] text-slate-500 font-medium">Available capabilities for this task</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TASK DETECTED</div>
             <div className="text-xs font-black text-indigo-300">{activeCategory}</div>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Dynamic Routing State Flow */}
          <div className="flex justify-between items-center px-4 py-2 bg-slate-900/60 rounded-xl border border-slate-800/80 mb-2">
             <div className="flex flex-col items-center flex-1">
                <span className={`text-[10px] font-black uppercase ${stage !== 'market' ? 'text-emerald-400' : 'text-slate-400'}`}>Understood</span>
                <div className={`h-1 w-full mt-1 ${stage !== 'market' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
             </div>
             <div className="flex flex-col items-center flex-1">
                <span className={`text-[10px] font-black uppercase ${stage === 'ready' || stage === 'paying' || stage === 'settling' || stage === 'verified' ? 'text-emerald-400' : 'text-slate-400'}`}>Optimized</span>
                <div className={`h-1 w-full mt-1 ${stage === 'ready' || stage === 'paying' || stage === 'settling' || stage === 'verified' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
             </div>
             <div className="flex flex-col items-center flex-1">
                <span className={`text-[10px] font-black uppercase ${stage === 'settling' || stage === 'verified' ? 'text-emerald-400' : (stage === 'paying' ? 'text-indigo-400' : 'text-slate-400')}`}>x402</span>
                <div className={`h-1 w-full mt-1 ${stage === 'settling' || stage === 'verified' ? 'bg-emerald-400' : (stage === 'paying' ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700')}`}></div>
             </div>
             <div className="flex flex-col items-center flex-1">
                <span className={`text-[10px] font-black uppercase ${stage === 'verified' ? 'text-emerald-400' : (stage === 'settling' ? 'text-indigo-400' : 'text-slate-400')}`}>Algorand</span>
                <div className={`h-1 w-full mt-1 ${stage === 'verified' ? 'bg-emerald-400' : (stage === 'settling' ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700')}`}></div>
             </div>
          </div>

          {/* Candidates / Capabilities */}
          <div className="flex gap-3">
             {(plan.candidates || []).map((candidate, idx) => {
               const isSelected = plan.endpointPath === candidate.endpoint_path;
               return (
                 <div key={idx} className={`flex-1 flex flex-col p-3 rounded-xl border transition-all ${isSelected ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-slate-800/60 bg-slate-900/40 opacity-70'}`}>
                   <div className="text-[9px] font-bold text-slate-400 uppercase">{activeCategory}</div>
                   <div className={`text-sm font-black mt-1 ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                     {getCandidateLabel(candidate.endpoint_path)}
                   </div>
                   <div className="text-xs font-mono text-slate-300 mt-0.5">${candidate.price.toFixed(2)}</div>
                   <div className="text-[10px] text-slate-500 mt-2 mb-3">{getCandidateDesc(candidate.endpoint_path)}</div>
                   <div className="mt-auto">
                     <div className={`text-[10px] font-bold px-2 py-1 rounded inline-block uppercase ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                       {isSelected ? '[ SELECTED ]' : '[ AVAILABLE ]'}
                     </div>
                   </div>
                 </div>
               )
             })}
          </div>

          {/* Optimization Layer */}
          {(stage === 'optimizing' || stage === 'ready' || stage === 'paying' || stage === 'settling' || stage === 'verified') && (
            <div className="animate-fade-in rounded-xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 to-slate-950/60 p-4 flex flex-col gap-3">
               <div className="flex items-center gap-1.5 border-b border-indigo-500/20 pb-2">
                  <FiCpu className="text-indigo-400 text-xs" />
                  <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">PRISM OPTIMIZATION</span>
               </div>
               
               <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                 <div className="flex justify-between items-center">
                    <span className="text-slate-400">Original request</span>
                    <span className="font-mono text-slate-300">{plan.originalInputTokens || 0} tokens</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-400">Semantic Cache</span>
                    <span className={`font-black uppercase ${plan.semanticCache?.cacheHit ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {plan.semanticCache?.cacheHit ? '✓ HIT' : 'MISS'}
                    </span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-400">Tokens saved</span>
                    <span className="font-mono text-emerald-400">{plan.totalTokensSaved || 0}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-400">Prompt Optimizer</span>
                    <span className={`font-black uppercase ${plan.optimizationApplied ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {plan.optimizationApplied ? 'APPLIED' : 'BYPASSED'}
                    </span>
                 </div>
                 <div className="flex justify-between items-center border-t border-slate-700/50 pt-2 mt-1 col-span-2">
                    <span className="text-slate-300 font-bold">Final execution input</span>
                    <span className="font-mono text-indigo-300 font-bold">{plan.optimizedInputTokens || 0} tokens</span>
                 </div>
               </div>
            </div>
          )}

          {/* Pricing Math */}
          {(stage === 'ready' || stage === 'paying' || stage === 'settling' || stage === 'verified') && (
            <div className="animate-fade-in flex flex-col gap-2 bg-slate-900/60 rounded-xl border border-slate-800/80 p-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 uppercase font-bold tracking-wider">BASE PRICE</span>
                  <span className="font-mono text-slate-300">${baseTotal.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 uppercase font-bold tracking-wider">OPTIMIZATION DISCOUNT</span>
                  <span className="font-mono text-emerald-400">-${totalSavings.toFixed(4)}</span>
                </div>
                <div className="border-t border-slate-700/50 my-1"></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white uppercase font-black tracking-wider flex items-center gap-2">
                    FINAL x402 PRICE
                  </span>
                  <span className="font-mono text-emerald-400 font-black">${finalTotal.toFixed(4)}</span>
                </div>
            </div>
          )}

          {/* Execution Progress display */}
          {(stage === 'paying' || stage === 'settling' || stage === 'verified') && (
            <div className="animate-fade-in rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-col gap-3 text-xs">
               {stage === 'paying' && (
                 <div className="flex flex-col gap-1">
                   <div className="font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                     <span className="loading loading-spinner loading-xs"></span> x402 PAYMENT REQUEST
                   </div>
                   <div className="text-slate-300">${finalTotal.toFixed(4)} USDC</div>
                   <div className="text-slate-500 mt-1">Network: Algorand MainNet</div>
                   <div className="text-slate-500">Status: Awaiting payment via wallet</div>
                 </div>
               )}
               {stage === 'settling' && (
                 <>
                   <div className="flex flex-col gap-1">
                     <div className="font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                       <FiCheckCircle /> PAYMENT VERIFIED
                     </div>
                     <div className="text-slate-400">x402 Payment confirmed</div>
                   </div>
                   <div className="border-t border-emerald-900/50 my-1"></div>
                   <div className="flex flex-col gap-1">
                     <div className="font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                       <span className="loading loading-spinner loading-xs"></span> ALGORAND SETTLEMENT
                     </div>
                     <div className="text-slate-400">Executing capability via smart contract</div>
                     <div className="text-slate-500 mt-1">{paymentStatus || 'Processing...'}</div>
                   </div>
                 </>
               )}
               {stage === 'verified' && (
                 <div className="flex flex-col gap-2">
                   <div className="font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                     <FiCheckCircle /> VERIFIED EXECUTION
                   </div>
                   <div className="text-slate-300 font-bold">{plan.providerName}</div>
                   <div className="grid grid-cols-1 gap-1 text-slate-400 mt-1 pl-1">
                     <div className="flex items-center gap-2"><FiCheckCircle className="text-emerald-500"/> Task understood</div>
                     <div className="flex items-center gap-2"><FiCheckCircle className="text-emerald-500"/> Capability selected</div>
                     <div className="flex items-center gap-2"><FiCheckCircle className="text-emerald-500"/> Optimization applied</div>
                     <div className="flex items-center gap-2"><FiCheckCircle className="text-emerald-500"/> x402 payment verified</div>
                     <div className="flex items-center gap-2"><FiCheckCircle className="text-emerald-500"/> Algorand settlement confirmed</div>
                     <div className="flex items-center gap-2"><FiCheckCircle className="text-emerald-500"/> Result generated</div>
                   </div>
                 </div>
               )}
            </div>
          )}

        </div>

      {/* Actions Footer */}
      <div className="px-5 py-3 border-t border-white/5 flex gap-2 shrink-0">
        {stage === 'ready' || stage === 'market' || stage === 'optimizing' ? (
          <>
            <button
              className="flex-1 btn btn-ghost text-slate-400 hover:text-white border border-slate-800/60 rounded-xl text-xs font-bold py-2"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="flex-[2] btn btn-primary rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform py-2"
              onClick={handleConfirm}
              disabled={stage !== 'ready' || selectedCount === 0}
            >
              {stage !== 'ready' ? 'Evaluating Options...' : `Confirm & Pay $${finalTotal.toFixed(2)}`}
            </button>
          </>
        ) : stage === 'verified' ? (
          <button
            className="w-full btn btn-primary rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform py-2"
            onClick={onCancel} // Closes the panel and reveals the underlying console with the result
          >
            [ VIEW RESULT ]
          </button>
        ) : (
          <div className="w-full flex justify-center items-center text-xs font-bold text-slate-400 py-2">
            Processing transaction...
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
export default ExecutionMarketPanel;
