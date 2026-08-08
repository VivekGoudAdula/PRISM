import React from 'react';
import { FiCheckCircle } from 'react-icons/fi';

export interface ExecutionProgressProps {
  current: number;
  total: number;
  category: string;
  phase: 'payment' | 'executing' | 'verifying' | 'completed';
  currentFilename?: string;
}

const unitLabel: Record<string, string> = {
  resume_screening: 'Resume',
  contract_analysis: 'Contract',
  invoice_extraction: 'Invoice',
};

export const ExecutionProgress: React.FC<ExecutionProgressProps> = ({
  current,
  total,
  category,
  phase,
  currentFilename,
}) => {
  const label = unitLabel[category] ?? 'File';
  const displayCurrent = Math.min(current, total > 0 ? total : current);
  const pct =
    phase === 'completed'
      ? 100
      : phase === 'verifying'
      ? 95
      : total > 0
      ? Math.min(90, Math.max(0, Math.round(((displayCurrent - 0.5) / total) * 90)))
      : 0;

  const phaseSteps = [
    { key: 'payment', label: 'Payment Approved', done: phase !== 'payment' },
    {
      key: 'executing',
      label: `Executing ${displayCurrent} / ${total}`,
      done: phase === 'verifying' || phase === 'completed',
      active: phase === 'executing' || phase === 'payment',
    },
    { key: 'verifying', label: 'Verifying Results', done: phase === 'completed', active: phase === 'verifying' },
    { key: 'completed', label: 'Completed', done: phase === 'completed', active: phase === 'completed' },
  ];

  return (
    <div className="text-center mb-8 flex flex-col items-center justify-center animate-fade-in w-full max-w-sm">
      {phase === 'completed' ? (
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
          <FiCheckCircle className="text-emerald-400 text-3xl" />
        </div>
      ) : (
        <div className="loading loading-spinner loading-lg text-primary mb-4" />
      )}

      <h2 className="text-xl font-extrabold text-white mb-1">
        {phase === 'completed' ? 'All done!' : 'Prism is working…'}
      </h2>

      {phase === 'executing' && currentFilename && (
        <p className="text-xs text-slate-500 mb-3 font-mono truncate max-w-[260px]">{currentFilename}</p>
      )}

      <div className="w-full flex flex-col gap-1.5 mb-4 text-left">
        {phaseSteps.map((step) => (
          <div
            key={step.key}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              step.done
                ? 'text-emerald-400 bg-emerald-500/8 border border-emerald-500/15'
                : step.active
                ? 'text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 animate-pulse'
                : 'text-slate-600 bg-slate-900/30 border border-slate-800/30'
            }`}
          >
            {step.done ? (
              <FiCheckCircle className="shrink-0 text-emerald-400" />
            ) : step.active ? (
              <span className="loading loading-spinner loading-xs text-indigo-400 shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
            )}
            <span>{step.label}</span>
            {step.key === 'executing' && phase === 'executing' && total > 1 && (
              <span className="ml-auto text-[10px] text-indigo-400 font-bold">
                {label} {displayCurrent}/{total}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-600 mt-1.5">{pct}% complete</p>
    </div>
  );
};
export default ExecutionProgress;
