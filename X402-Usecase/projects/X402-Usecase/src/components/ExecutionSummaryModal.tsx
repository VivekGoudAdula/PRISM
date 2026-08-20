import React, { useState } from 'react';
import { FiZap, FiCpu, FiShield, FiDollarSign, FiClock } from 'react-icons/fi';
import type { ExecutionPlan, AttachedFile, PaymentPreviewItem } from '../utils/prismApi';

export interface ExecutionSummaryModalProps {
  plan: ExecutionPlan;
  files: AttachedFile[];
  onConfirm: (filteredFiles: AttachedFile[], updatedPlan: ExecutionPlan) => void;
  onCancel: () => void;
}

const categoryLabel: Record<string, string> = {
  resume_screening: 'Resume Screening',
  contract_analysis: 'Contract Analysis',
  invoice_extraction: 'Invoice Extraction',
  code_review: 'Code Review',
  seo_audit: 'SEO Audit',
};

export const ExecutionSummaryModal: React.FC<ExecutionSummaryModalProps> = ({
  plan,
  files,
  onConfirm,
  onCancel,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(
      files.length > 0
        ? files.map((_, i) => i)
        : Array.from({ length: plan.executionQuantity }, (_, i) => i)
    )
  );

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
  const accuracyPct = Math.round((plan.estimatedAccuracy ?? 0) * 100);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20"
      style={{ background: 'rgba(2,4,18,0.88)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="w-full max-w-lg animate-scale-up rounded-3xl border border-indigo-500/20 shadow-2xl flex flex-col"
        style={{
          maxHeight: '78vh',
          background: 'linear-gradient(135deg, rgba(15,18,45,0.99) 0%, rgba(8,12,30,0.99) 100%)',
          boxShadow: '0 0 80px rgba(99,102,241,0.15), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header — fixed, never scrolls */}
        <div className="px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <FiZap className="text-indigo-400 text-sm" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight">Execution Summary</h2>
              <p className="text-xs text-slate-500">Review payment breakdown before approving</p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-4 flex flex-col gap-1 overflow-y-auto flex-1">
          {plan.category === 'seo_audit' && (
            <div className="mb-4 flex flex-col gap-2.5">
              <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 text-xs text-indigo-200 flex flex-col gap-1 shadow-inner">
                <span className="font-extrabold text-sm text-white">Website SEO Audit Plan</span>
                <p>
                  This will audit <strong className="text-emerald-400 font-bold">{selectedCount} pages</strong> for{' '}
                  <strong className="text-emerald-400 font-bold">${totalCost.toFixed(2)} total</strong> ({selectedCount} × ${plan.unitPrice.toFixed(2)}{plan.platformFee > 0 ? ` + $${plan.platformFee.toFixed(2)} platform fee` : ''}). Continue?
                </p>
                {(plan.skipped || 0) > 0 && (
                  <span className="text-[11px] text-indigo-300/80 font-medium mt-1">
                    ℹ️ Note: {plan.skipped} additional pages skipped due to page limit cap.
                  </span>
                )}
              </div>
            </div>
          )}

          {plan.category === 'code_review' && (
            <div className="mb-4 flex flex-col gap-2.5">
              {plan.capped && (
                <div className="rounded-2xl border border-amber-500/60 bg-amber-950/50 p-4 text-xs text-amber-200 flex flex-col gap-1.5 shadow-lg">
                  <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs uppercase tracking-wider">
                    <span className="text-base">⚠️</span>
                    <span>Repository File Limit Reached</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {plan.cap_message ||
                      `This repo has ${plan.total_files_found || plan.executionQuantity + (plan.skipped || 0)} reviewable files. Reviewing the ${selectedCount} highest-priority source files first (${plan.skipped || 0} skipped).`}
                  </p>
                  <span className="text-[11px] text-amber-300/80 font-mono">
                    Note: High-priority source files (.ts, .py, .go, .java, src/ folders) are prioritized first.
                  </span>
                </div>
              )}

              <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 text-xs text-indigo-200 flex flex-col gap-1 shadow-inner">
                <span className="font-extrabold text-sm text-white">GitHub Repository Review Plan</span>
                <p>
                  This will review <strong className="text-emerald-400 font-bold">{selectedCount} files</strong> for{' '}
                  <strong className="text-emerald-400 font-bold">${totalCost.toFixed(2)} total</strong> ({selectedCount} × ${plan.unitPrice.toFixed(2)}{plan.platformFee > 0 ? ` + $${plan.platformFee.toFixed(2)} platform fee` : ''}). Continue?
                </p>
                {!plan.capped && (plan.skipped || 0) > 0 && (
                  <span className="text-[11px] text-indigo-300/80 font-medium mt-1">
                    ℹ️ Note: {plan.skipped} non-code/large files were automatically excluded.
                  </span>
                )}
              </div>
            </div>
          )}

          {([
            {
              icon: <FiCpu className="text-indigo-400" />,
              label: 'Task Category',
              value: categoryLabel[plan.category] ?? plan.category,
            },
            {
              icon: <FiShield className="text-sky-400" />,
              label: 'Provider',
              value: plan.providerName,
            },
            {
              icon: <FiDollarSign className="text-emerald-400" />,
              label: 'Unit Price',
              value: `$${plan.unitPrice.toFixed(2)} USDC / file`,
            },
            {
              icon: <FiZap className="text-amber-400" />,
              label: 'Executions',
              value: `${selectedCount} file${selectedCount !== 1 ? 's' : ''}`,
            },
          ] as { icon: React.ReactNode; label: string; value: string }[]).map(({ icon, label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-white/4">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                {icon}
                {label}
              </div>
              <span className="text-xs font-semibold text-slate-200">{value}</span>
            </div>
          ))}

          {/* Dynamic Pricing Breakdown */}
          {(() => {
            const baseUnitPrice = plan.basePrice ?? plan.dynamicPrice?.basePrice ?? plan.unitPrice;
            const unitDiscount = plan.optimizationDiscount ?? plan.dynamicPrice?.optimizationDiscount ?? 0;
            const savingsPct = plan.reductionPercentage ?? Math.round((plan.savingsRate ?? 0) * 100);
            const totalDiscount = unitDiscount * selectedCount;
            const totalBasePrice = baseUnitPrice * selectedCount;

            return (
              <div className="mt-3 rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-950/30 to-slate-950/60 p-4 flex flex-col gap-2.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <FiZap className="text-emerald-400 text-xs" />
                    <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">
                      PRISM OPTIMIZED PRICE
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400/90 font-medium">
                    Price reduced by PRISM optimization
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Base price</span>
                    <span className="font-mono font-medium text-slate-300">${totalBasePrice.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Context saved</span>
                    <span className="font-mono font-semibold text-emerald-400">{savingsPct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>PRISM discount</span>
                    <span className="font-mono font-semibold text-emerald-400">-${totalDiscount.toFixed(4)}</span>
                  </div>
                  <div className="my-0.5 border-t border-slate-700/60" />
                  <div className="flex items-center justify-between font-extrabold text-sm text-white">
                    <span>You pay</span>
                    <span className="font-mono text-emerald-300">${totalCost.toFixed(4)}</span>
                  </div>
                </div>

                {totalDiscount > 0 && (
                  <div className="mt-0.5 inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold shadow-sm">
                    <span>✓ You saved ${totalDiscount.toFixed(4)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Payment Breakdown */}
          {preview.length > 0 && (
            <div className="mt-3 rounded-2xl border border-slate-700/40 bg-slate-950/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiDollarSign className="text-indigo-400 text-xs" />
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Payment Breakdown
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="checkbox checkbox-xs checkbox-primary border-indigo-500/40 rounded bg-slate-950"
                  />
                  <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                </label>
              </div>
              <div className="flex flex-col divide-y divide-slate-800/40 max-h-48 overflow-y-auto">
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
                      className={`flex items-center justify-between px-4 py-2 transition-opacity duration-200 ${
                        item.type === 'execution' && !isChecked ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {item.type === 'execution' ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => item.index !== undefined && toggleSelectFile(item.index - 1)}
                            className="checkbox checkbox-xs checkbox-primary border-indigo-500/40 rounded bg-slate-950"
                          />
                        ) : (
                          <span className="w-5 h-5 rounded bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-[9px] font-black text-violet-400">
                            ₱
                          </span>
                        )}
                        {item.type === 'execution' && (
                          <span className="w-5 h-5 rounded bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-[9px] font-black text-indigo-400">
                            {item.index}
                          </span>
                        )}
                        <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                          {item.label}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          item.type === 'platform_fee' ? 'text-violet-300' : 'text-emerald-300'
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
          <div className="mt-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/8 p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-indigo-300">Total Payment</span>
              <span className="text-[10px] text-slate-500 font-medium">
                One wallet approval — consolidated Algorand tx
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-white">${totalCost.toFixed(4)}</span>
              <span className="text-[10px] text-indigo-400 font-semibold">USDC on Algorand</span>
            </div>
          </div>
        </div>

        {/* Actions — fixed footer, never scrolls */}
        <div className="px-6 py-4 border-t border-white/5 flex gap-3 shrink-0">
          <button
            className="flex-1 btn btn-ghost text-slate-400 hover:text-white border border-slate-800/60 rounded-xl text-sm font-bold"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex-1 btn btn-primary rounded-xl text-sm font-extrabold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            Confirm &amp; Pay ${totalCost.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ExecutionSummaryModal;
