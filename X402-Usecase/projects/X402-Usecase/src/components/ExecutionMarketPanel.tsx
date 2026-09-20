import React, { useState, useEffect } from 'react';
import { FiZap, FiDollarSign, FiCpu, FiShield } from 'react-icons/fi';
import type { ExecutionPlan, AttachedFile, PaymentPreviewItem } from '../utils/prismApi';

export interface ExecutionMarketPanelProps {
  plan: ExecutionPlan;
  files: AttachedFile[];
  onConfirm: (filteredFiles: AttachedFile[], updatedPlan: ExecutionPlan) => void;
  onCancel: () => void;
  execProgress?: any;
  paymentStatus?: string;
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
}) => {
  const [screen, setScreen] = useState<'market' | 'summary'>('market');

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(
      files.length > 0
        ? files.map((_, i) => i)
        : Array.from({ length: plan.executionQuantity }, (_, i) => i)
    )
  );

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (screen === 'market') {
      // Show market selection for 2.5 seconds, then switch to summary
      timer = setTimeout(() => setScreen('summary'), 2500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [screen]);

  const toggleSelectFile = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const totalExecutionItems = Math.max(
    files.length,
    plan.executionQuantity,
    ((plan as any).pages || []).length,
    ((plan as any).files || []).length
  );

  const isAllSelected = totalExecutionItems > 0 && selectedIndices.size === totalExecutionItems;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(Array.from({ length: totalExecutionItems }, (_, i) => i)));
    }
  };

  const selectedCount = selectedIndices.size;
  const executionCost = selectedCount * plan.unitPrice;
  const totalCost = selectedCount > 0 ? executionCost + plan.platformFee : 0;
  const baseTotal = plan.baseTotal ?? ((plan.basePrice ?? plan.unitPrice) * selectedCount);
  const totalSavings = plan.totalOptimizationDiscount ?? ((plan.optimizationDiscount ?? 0) * selectedCount);
  
  // Find the static price of the selected candidate to scale prices properly
  const winnerStaticPrice = plan.candidates?.find((c) => c.endpoint_path === plan.endpointPath)?.price || plan.unitPrice;

  const preview: PaymentPreviewItem[] = plan.paymentPreview ?? [];

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
      paymentPreview: plan.paymentPreview
        ? plan.paymentPreview.filter((item) => {
            if (item.type === 'platform_fee') return true;
            return item.index !== undefined && selectedIndices.has(item.index - 1);
          })
        : [],
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
        <div className="px-5 py-4 border-b border-white/5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <FiZap className="text-indigo-400 text-xs" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {screen === 'market' ? 'EXECUTION MARKET' : 'EXECUTION SUMMARY'}
              </h2>
              <p className="text-[10px] text-slate-500 font-medium">
                {screen === 'market' ? 'Available capabilities for this task' : 'Review payment breakdown before approving'}
              </p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TASK DETECTED</div>
             <div className="text-xs font-black text-indigo-300">{activeCategory}</div>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto flex-1">
          
          {screen === 'market' && (
            <div className="flex gap-3 animate-fade-in">
               {(plan.candidates || []).map((candidate, idx) => {
                 const isSelected = plan.endpointPath === candidate.endpoint_path;
                 const displayPrice = winnerStaticPrice > 0 ? (candidate.price / winnerStaticPrice) * baseTotal : candidate.price;
                 
                 return (
                   <div key={idx} className={`flex-1 flex flex-col p-3 rounded-xl border transition-all ${isSelected ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-slate-800/60 bg-slate-900/40 opacity-70'}`}>
                     <div className="text-[9px] font-bold text-slate-400 uppercase">{activeCategory}</div>
                     <div className={`text-sm font-black mt-1 ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                       {getCandidateLabel(candidate.endpoint_path)}
                     </div>
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
          )}

          {screen === 'summary' && (
            <div className="flex flex-col gap-2 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-3 items-stretch">
                {/* LEFT SIDE: Plan & Metadata */}
                <div className="flex flex-col gap-2 flex-1 justify-between">
                  {/* Category specific summary */}
                  {plan.category === 'seo_audit' && (
                    <div className="flex flex-col gap-1">
                      <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/40 p-2.5 text-[10px] text-indigo-200 flex flex-col gap-0.5 shadow-inner h-full">
                        <span className="font-extrabold text-[11px] text-white">Website SEO Audit Plan</span>
                        <p>
                          This will audit <strong className="text-emerald-400 font-bold">{selectedCount} pages</strong> for{' '}
                          <strong className="text-emerald-400 font-bold">${totalCost.toFixed(2)} total</strong> ({selectedCount} × ${plan.unitPrice.toFixed(2)}{plan.platformFee > 0 ? ` + $${plan.platformFee.toFixed(2)} platform fee` : ''}). Continue?
                        </p>
                        {(plan.skipped || 0) > 0 && (
                          <span className="text-[9px] text-indigo-300/80 font-medium mt-auto pt-1">
                            ℹ️ Note: {plan.skipped} additional pages skipped due to page limit cap.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {plan.category === 'code_review' && (
                    <div className="flex flex-col gap-1 h-full">
                      {plan.capped && (
                        <div className="rounded-xl border border-amber-500/60 bg-amber-950/50 p-2.5 text-[10px] text-amber-200 flex flex-col gap-1 shadow-lg mb-1">
                          <div className="flex items-center gap-1.5 text-amber-300 font-extrabold text-[9px] uppercase tracking-wider">
                            <span className="text-xs">⚠️</span>
                            <span>Repository File Limit Reached</span>
                          </div>
                          <p className="leading-relaxed font-medium text-[9px]">
                            {plan.cap_message ||
                              `This repo has ${plan.total_files_found || plan.executionQuantity + (plan.skipped || 0)} reviewable files. Reviewing the ${selectedCount} highest-priority source files first (${plan.skipped || 0} skipped).`}
                          </p>
                          <span className="text-[9px] text-amber-300/80 font-mono">
                            Note: High-priority source files (.ts, .py, .go, .java, src/ folders) are prioritized first.
                          </span>
                        </div>
                      )}

                      <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/40 p-2.5 text-[10px] text-indigo-200 flex flex-col gap-0.5 shadow-inner h-full">
                        <span className="font-extrabold text-[11px] text-white">GitHub Repository Review Plan</span>
                        <p>
                          This will review <strong className="text-emerald-400 font-bold">{selectedCount} files</strong> for{' '}
                          <strong className="text-emerald-400 font-bold">${totalCost.toFixed(2)} total</strong> (workload-based pricing per file{plan.platformFee > 0 ? ` + $${plan.platformFee.toFixed(2)} platform fee` : ''}). Continue?
                        </p>
                        {!plan.capped && (plan.skipped || 0) > 0 && (
                          <span className="text-[9px] text-indigo-300/80 font-medium mt-auto pt-1">
                            ℹ️ Note: {plan.skipped} non-code/large files were automatically excluded.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Compact Metadata Grid */}
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40 border border-slate-800/40">
                      <div className="flex items-center gap-1 text-slate-400 font-medium">
                        <FiCpu className="text-indigo-400 text-[10px]" />
                        Category
                      </div>
                      <span className="font-semibold text-slate-200">{categoryLabel[plan.category] ?? plan.category}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40 border border-slate-800/40">
                      <div className="flex items-center gap-1 text-slate-400 font-medium">
                        <FiShield className="text-sky-400 text-[10px]" />
                        Provider
                      </div>
                      <span className="font-semibold text-slate-200">{plan.providerName}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40 border border-slate-800/40">
                      <div className="flex items-center gap-1 text-slate-400 font-medium">
                        <FiDollarSign className="text-emerald-400 text-[10px]" />
                        Unit Price
                      </div>
                      <span className="font-semibold text-slate-200">{plan.category === 'code_review' ? `Workload-based ($${plan.unitPrice.toFixed(3)} avg)` : `$${plan.unitPrice.toFixed(2)} / file`}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40 border border-slate-800/40">
                      <div className="flex items-center gap-1 text-slate-400 font-medium">
                        <FiZap className="text-amber-400 text-[10px]" />
                        Executions
                      </div>
                      <span className="font-semibold text-slate-200">{selectedCount} file{selectedCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE: Optimization Savings */}
                <div className="flex flex-col flex-1">
                  {/* Dynamic Workload & Optimization Pricing Summary */}
                  <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-b from-emerald-950/30 to-slate-950/60 p-3 flex flex-col gap-1.5 shadow-md h-full">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FiZap className="text-emerald-400 text-xs" />
                        <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
                          PRISM OPTIMIZATION SAVINGS
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-[11px] mt-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Original price</span>
                        <span className="font-mono font-medium text-slate-300">${baseTotal.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 mt-1">
                        <span>Optimization savings</span>
                        <span className="font-mono font-semibold text-emerald-400">-${totalSavings.toFixed(4)}</span>
                      </div>
                      <div className="my-1.5 border-t border-slate-700/60" />
                      <div className="flex items-center justify-between font-extrabold text-[13px] text-white mt-auto">
                        <span>Final Base cost</span>
                        <span className="font-mono text-emerald-300">${(baseTotal - totalSavings).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Breakdown Box */}
              {preview.length > 0 && (
                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/95 overflow-hidden shadow-xl flex flex-col min-h-[140px] max-h-56 mt-2">
                  <div className="px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/80 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <FiDollarSign className="text-indigo-400 text-xs" />
                      <span className="text-[10px] font-black text-slate-100 uppercase tracking-widest">
                        PAYMENT BREAKDOWN
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-indigo-300 hover:text-indigo-200 transition-colors">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="checkbox checkbox-xs checkbox-primary border-indigo-500/40 rounded bg-slate-950"
                      />
                      <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                    </label>
                  </div>
                  <div className="flex flex-col divide-y divide-slate-800/50 max-h-48 overflow-y-auto">
                    {preview.map((item, idx) => {
                      const isChecked =
                        item.type === 'execution'
                          ? item.index !== undefined
                            ? selectedIndices.has(item.index - 1)
                            : false
                          : true;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between px-3.5 py-1.5 transition-opacity duration-200 ${
                            item.type === 'execution' && !isChecked ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {item.type === 'execution' ? (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => item.index !== undefined && toggleSelectFile(item.index - 1)}
                                className="checkbox checkbox-xs checkbox-primary border-indigo-500/40 rounded bg-slate-950 cursor-pointer"
                              />
                            ) : (
                              <span className="w-4 h-4 rounded bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-[8px] font-black text-violet-400">
                                ₱
                              </span>
                            )}
                            {item.type === 'execution' && (
                              <span className="w-4 h-4 rounded bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-[8px] font-black text-indigo-400">
                                {item.index}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-200 font-semibold truncate max-w-[260px]">
                              {item.label}
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-mono font-bold ${
                              item.type === 'platform_fee' ? 'text-violet-300' : 'text-emerald-400'
                            }`}
                          >
                            ${item.amount.toFixed(4)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="mt-1 rounded-xl border border-indigo-500/30 bg-indigo-500/8 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-indigo-300">Total Payment Cumulative</span>
                  <span className="text-xs text-slate-500 font-medium">
                    One wallet approval — consolidated Algorand tx
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xl font-black text-white">${totalCost.toFixed(4)}</span>
                  <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">USDC on Algorand</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Actions Footer */}
        {screen === 'summary' ? (
          <div className="px-5 py-3 border-t border-white/5 flex gap-2 shrink-0">
            <button
              className="flex-1 btn btn-ghost text-slate-400 hover:text-white border border-slate-800/60 rounded-xl text-xs font-bold py-2"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="flex-[2] btn btn-primary rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform py-2"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
            >
              Confirm & Pay ${totalCost.toFixed(2)}
            </button>
          </div>
        ) : (
          <div className="px-5 py-3 border-t border-white/5 flex gap-2 shrink-0 h-[64px] items-center justify-center">
            <span className="loading loading-spinner loading-xs text-indigo-500 mr-2"></span>
            <span className="text-xs text-slate-400 font-bold">Prism is optimizing path...</span>
          </div>
        )}
      </div>
    </div>
  );
};
export default ExecutionMarketPanel;
