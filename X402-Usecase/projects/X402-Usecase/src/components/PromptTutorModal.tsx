import React, { useState } from 'react';
import type { PromptAnalysisResult } from '../utils/prismApi';
import { FiZap, FiCheck, FiCopy, FiInfo, FiAlertTriangle, FiCheckCircle, FiX } from 'react-icons/fi';

export interface PromptTutorModalProps {
  analysis: PromptAnalysisResult;
  originalPrompt: string;
  onUseImproved: (improvedPrompt: string) => void;
  onKeepOriginal: () => void;
  onClose: () => void;
}

export const PromptTutorModal: React.FC<PromptTutorModalProps> = ({
  analysis,
  originalPrompt,
  onUseImproved,
  onKeepOriginal,
  onClose,
}) => {
  const {
    score = 70,
    intent = 'Task Execution',
    taskType = 'general_query',
    issues = [],
    requiredInformation = [],
    irrelevantInformation = [],
    suggestions = [],
    improvedPrompt = originalPrompt,
  } = analysis;

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'improved' | 'original'>('improved');
  const [editedImprovedPrompt, setEditedImprovedPrompt] = useState(improvedPrompt);
  const [editedOriginalPrompt, setEditedOriginalPrompt] = useState(originalPrompt);

  // Dynamic Theme Colors based on Score
  const isHigh = score >= 80;
  const isMedium = score >= 55 && score < 80;

  const scoreBadgeBg = isHigh
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
    : isMedium
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    : 'bg-rose-500/10 border-rose-500/30 text-rose-300';

  const scoreTextColor = isHigh ? 'text-emerald-400' : isMedium ? 'text-amber-400' : 'text-rose-400';

  const handleCopy = () => {
    const textToCopy = activeTab === 'improved' ? editedImprovedPrompt : editedOriginalPrompt;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTaskType = taskType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      style={{ background: 'rgba(2, 4, 18, 0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div className="w-full max-w-5xl liquid-glass flex flex-col max-h-[85vh] animate-scale-up overflow-hidden text-slate-100 font-sans">
        {/* Widescreen Apple Liquid Glass Header */}
        <div className="px-6 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <FiZap className="text-indigo-400 text-sm" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">Prompt Tutor</h2>
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                Optimization Layer
              </span>
              <div className="h-3 w-px bg-white/10 mx-1 hidden sm:block" />
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Intent:</span>
                <span className="px-2 py-0.5 rounded-lg font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-[11px]">
                  {intent}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Task:</span>
                <span className="px-2 py-0.5 rounded-lg font-bold bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[11px]">
                  {formattedTaskType}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Quality Score Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold ${scoreBadgeBg}`}>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Quality Score:</span>
              <span className={`text-sm font-black ${scoreTextColor}`}>{score}/100</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Close Prompt Tutor"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Widescreen Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs leading-relaxed">
          {/* 3-Column Side-by-Side Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
            {/* Column 1: Issues Detected */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3.5 flex flex-col gap-2 min-h-[140px]">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-400 uppercase tracking-wider">
                <FiAlertTriangle className="text-xs shrink-0" />
                <span>Issues Detected</span>
              </div>
              {issues.length > 0 ? (
                <ul className="space-y-1.5 text-[11px] text-amber-200/90 leading-relaxed font-medium pl-4 list-disc">
                  {issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[11px] text-amber-300/60 italic">No critical issues detected</span>
              )}
            </div>

            {/* Column 2: Recommended Improvements */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex flex-col gap-2 min-h-[140px]">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
                <FiCheckCircle className="text-xs shrink-0" />
                <span>Recommended Improvements</span>
              </div>
              {suggestions.length > 0 ? (
                <ul className="space-y-1.5 text-[11px] text-emerald-200/90 leading-relaxed font-medium pl-4 list-disc">
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[11px] text-emerald-300/60 italic">No further suggestions needed</span>
              )}
            </div>

            {/* Column 3: Required Context */}
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 flex flex-col gap-2 min-h-[140px]">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-400 uppercase tracking-wider">
                <FiInfo className="text-xs shrink-0" />
                <span>Required Context</span>
              </div>
              {requiredInformation.length > 0 ? (
                <ul className="space-y-1.5 text-[11px] text-indigo-200/90 leading-relaxed font-medium pl-4 list-disc">
                  {requiredInformation.map((info, idx) => (
                    <li key={idx}>{info}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[11px] text-indigo-300/60 italic">All required context provided</span>
              )}
            </div>
          </div>

          {/* Potentially Irrelevant Info (if any) */}
          {irrelevantInformation.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <FiInfo className="text-xs shrink-0" />
                <span>Potentially Irrelevant Information</span>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-400 pl-4 list-disc font-medium">
                {irrelevantInformation.map((info, idx) => (
                  <li key={idx}>{info}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Editable Prompt Selector */}
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('improved')}
                  className={`btn text-xs font-bold ${activeTab === 'improved' ? 'btn-primary' : 'btn-outline'}`}
                >
                  Improved Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('original')}
                  className={`btn text-xs font-bold ${activeTab === 'original' ? 'btn-primary' : 'btn-outline'}`}
                >
                  Original Prompt
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 text-xs font-medium transition-colors"
              >
                {copied ? (
                  <>
                    <FiCheck className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <FiCopy />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Editable Textarea in Liquid Glass style */}
            <div className="relative">
              <textarea
                value={activeTab === 'improved' ? editedImprovedPrompt : editedOriginalPrompt}
                onChange={(e) => {
                  if (activeTab === 'improved') {
                    setEditedImprovedPrompt(e.target.value);
                  } else {
                    setEditedOriginalPrompt(e.target.value);
                  }
                }}
                placeholder={activeTab === 'improved' ? 'Edit improved prompt...' : 'Edit original prompt...'}
                className="textarea w-full p-3.5 font-sans text-slate-100 text-xs leading-relaxed max-h-32 min-h-[85px] resize-y rounded-2xl focus:outline-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Compact Liquid Glass Actions Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto btn btn-outline text-xs font-bold"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onKeepOriginal}
              className="flex-1 sm:flex-initial btn text-xs font-bold"
            >
              Keep Original
            </button>
            <button
              type="button"
              onClick={() => onUseImproved(editedImprovedPrompt)}
              className="flex-1 sm:flex-initial btn btn-primary text-xs font-extrabold flex items-center justify-center gap-2"
            >
              <FiZap className="text-sm" />
              Use Improved Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptTutorModal;
