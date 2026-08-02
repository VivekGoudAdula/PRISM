import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  planTask,
  executeTaskWithPayment,
  type ExecutionPlan,
  type AttachedFile,
  type ExecuteTaskResponse,
  type PaymentPreviewItem,
} from '../utils/weatherApi';
import { api } from '../utils/api';
import { FiCheckCircle, FiPlus, FiSend, FiMessageSquare, FiZap, FiCpu, FiDollarSign, FiClock, FiShield, FiLink } from 'react-icons/fi';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeatherProps {
  activeTab: 'terminal' | 'history' | 'chats';
  setActiveTab: (tab: 'terminal' | 'history' | 'chats') => void;
  onTaskComplete?: () => void;
  selectedHistoryTask?: any;
}

// ─── Execution Summary Modal ──────────────────────────────────────────────────

interface ExecutionSummaryModalProps {
  plan: ExecutionPlan;
  files: AttachedFile[];
  onConfirm: (filteredFiles: AttachedFile[], updatedPlan: ExecutionPlan) => void;
  onCancel: () => void;
}

/**
 * Displays the computed execution plan to the user before payment.
 * Shows: provider, unit price, per-file payment breakdown, platform fee, total.
 * The "Confirm & Pay" button triggers ONE wallet popup for the consolidated total.
 */
const ExecutionSummaryModal: React.FC<ExecutionSummaryModalProps> = ({ plan, files, onConfirm, onCancel }) => {
  const categoryLabel: Record<string, string> = {
    resume_screening: 'Resume Screening',
    contract_analysis: 'Contract Analysis',
    invoice_extraction: 'Invoice Extraction',
    code_review: 'Code Review',
  };

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(files.length > 0 ? files.map((_, i) => i) : Array.from({ length: plan.executionQuantity }, (_, i) => i))
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
      paymentPreview: plan.paymentPreview ? plan.paymentPreview.filter(item => {
        if (item.type === 'platform_fee') return true;
        return item.index !== undefined && selectedIndices.has(item.index - 1);
      }) : []
    };
    onConfirm(filteredFiles, updatedPlan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,4,18,0.88)', backdropFilter: 'blur(10px)' }}>
      <div
        className="w-full max-w-lg animate-scale-up rounded-3xl border border-indigo-500/20 shadow-2xl overflow-y-auto"
        style={{
          maxHeight: '92vh',
          background: 'linear-gradient(135deg, rgba(15,18,45,0.99) 0%, rgba(8,12,30,0.99) 100%)',
          boxShadow: '0 0 80px rgba(99,102,241,0.15), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <FiZap className="text-indigo-400 text-base" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">Execution Summary</h2>
              <p className="text-xs text-slate-500">Review payment breakdown before approving</p>
            </div>
          </div>
        </div>

        {/* Summary Table */}
        <div className="px-7 py-5 flex flex-col gap-1">

          {/* Banner confirmation for GitHub Code Review */}
          {plan.category === 'code_review' && (
            <div className="mb-4 flex flex-col gap-2.5">
              {plan.capped && (
                <div className="rounded-2xl border border-amber-500/60 bg-amber-950/50 p-4 text-xs text-amber-200 flex flex-col gap-1.5 shadow-lg">
                  <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs uppercase tracking-wider">
                    <span className="text-base">⚠️</span>
                    <span>Repository File Limit Reached</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {plan.cap_message || `This repo has ${plan.total_files_found || (plan.executionQuantity + (plan.skipped || 0))} reviewable files. Reviewing the ${selectedCount} highest-priority source files first (${plan.skipped || 0} skipped).`}
                  </p>
                  <span className="text-[11px] text-amber-300/80 font-mono">
                    Note: High-priority source files (.ts, .py, .go, .java, src/ folders) are prioritized first.
                  </span>
                </div>
              )}

              <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 text-xs text-indigo-200 flex flex-col gap-1 shadow-inner">
                <span className="font-extrabold text-sm text-white">GitHub Repository Review Plan</span>
                <p>
                  This will review <strong className="text-emerald-400 font-bold">{selectedCount} files</strong> for <strong className="text-emerald-400 font-bold">${totalCost.toFixed(2)} total</strong> ({selectedCount} × ${plan.unitPrice.toFixed(2)} + ${plan.platformFee.toFixed(2)} platform fee). Continue?
                </p>
                {!plan.capped && (plan.skipped || 0) > 0 && (
                  <span className="text-[11px] text-indigo-300/80 font-medium mt-1">
                    ℹ️ Note: {plan.skipped} non-code/large files were automatically excluded.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Provider / Category rows */}
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

          {/* ── Payment Breakdown (per-file itemisation) ── */}
          {preview.length > 0 && (
            <div className="mt-3 rounded-2xl border border-slate-700/40 bg-slate-950/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center gap-2">
                <FiDollarSign className="text-indigo-400 text-xs" />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Payment Breakdown</span>
              </div>
              <div className="flex flex-col divide-y divide-slate-800/40">
                {preview.map((item, idx) => {
                  const isChecked = item.type === 'execution' ? (item.index !== undefined ? selectedIndices.has(item.index - 1) : false) : true;
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
                          <span className="w-5 h-5 rounded bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-[9px] font-black text-violet-400">₱</span>
                        )}
                        {item.type === 'execution' && (
                          <span className="w-5 h-5 rounded bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-[9px] font-black text-indigo-400">
                            {item.index}
                          </span>
                        )}
                        <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">{item.label}</span>
                      </div>
                      <span className={`text-xs font-bold ${item.type === 'platform_fee' ? 'text-violet-300' : 'text-emerald-300'}`}>
                        ${item.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time & Accuracy */}
          <div className="flex gap-3 mt-3">
            <div className="flex-1 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                <FiClock className="text-xs" /> Est. Time
              </div>
              <span className="text-sm font-extrabold text-slate-200">~{plan.estimatedTimeSeconds}s</span>
            </div>
            <div className="flex-1 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                <FiShield className="text-xs" /> Accuracy
              </div>
              <span className="text-sm font-extrabold text-emerald-400">{accuracyPct}%</span>
            </div>
          </div>

          {/* Total */}
          <div className="mt-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/8 p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-indigo-300">Total Payment</span>
              <span className="text-[10px] text-slate-500 font-medium">One wallet approval — consolidated Algorand tx</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-white">${totalCost.toFixed(2)}</span>
              <span className="text-[10px] text-indigo-400 font-semibold">USDC on Algorand</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-7 pb-7 flex gap-3">
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

// ─── Progress Display ─────────────────────────────────────────────────────────

interface ExecutionProgressProps {
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

/**
 * Stepped execution progress display.
 * Phases: payment approved → executing 1/N → ... → verifying → completed.
 */
const ExecutionProgress: React.FC<ExecutionProgressProps> = ({
  current,
  total,
  category,
  phase,
  currentFilename,
}) => {
  const label = unitLabel[category] ?? 'File';
  const pct = phase === 'completed'
    ? 100
    : phase === 'verifying'
      ? 95
      : total > 0
        ? Math.round(((current - 0.5) / total) * 90)
        : 0;

  const phaseSteps = [
    { key: 'payment',   label: 'Payment Approved',   done: phase !== 'payment' },
    { key: 'executing', label: `Executing ${current} / ${total}`, done: phase === 'verifying' || phase === 'completed', active: phase === 'executing' || phase === 'payment' },
    { key: 'verifying', label: 'Verifying Results',  done: phase === 'completed', active: phase === 'verifying' },
    { key: 'completed', label: 'Completed',           done: phase === 'completed', active: phase === 'completed' },
  ];

  return (
    <div className="text-center mb-8 flex flex-col items-center justify-center animate-fade-in w-full max-w-sm">

      {/* Spinner or checkmark */}
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

      {/* Step list */}
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
              <span className="ml-auto text-[10px] text-indigo-400 font-bold">{label} {current}/{total}</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
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

// ─── Main Component ────────────────────────────────────────────────────────────

const Weather: React.FC<WeatherProps> = ({ activeTab, setActiveTab, onTaskComplete, selectedHistoryTask }) => {
  const { activeAddress, signTransactions } = useWallet();

  // ── Input state ──────────────────────────────────────────────────────────────
  const [taskDescription, setTaskDescription] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // ── Pipeline state ───────────────────────────────────────────────────────────
  const [isPlanning, setIsPlanning] = useState(false);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [execProgress, setExecProgress] = useState<{
    current: number;
    total: number;
    category: string;
    phase: 'payment' | 'executing' | 'verifying' | 'completed';
    currentFilename?: string;
  } | null>(null);

  // ── Result / error state ─────────────────────────────────────────────────────
  const [taskResult, setTaskResult] = useState<ExecuteTaskResponse | null>(null);
  const [error, setError] = useState<string>('');

  // ── Tab / history state ──────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<any[]>([]);

  // ── Persistent Chat Thread State ─────────────────────────────────────────────
  const [chatHistory, setChatHistory] = useState<Array<{
    id: string;
    prompt: string;
    files?: AttachedFile[];
    result?: ExecuteTaskResponse;
    reply?: string;
    isChatReply?: boolean;
    error?: string;
    timestamp: Date;
  }>>([]);

  /** MongoDB Conversation._id for the active chat session (null = no session yet) */
  const [conversationId, setConversationId] = useState<string | null>(null);

  const chatScrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedHistoryTask) return;

    // Case 1: It's a saved Conversation (has a thread array)
    if (selectedHistoryTask._type === 'conversation') {
      const rawThread: any[] = selectedHistoryTask.thread || [];
      // Re-hydrate timestamps as Date objects
      const hydratedThread = rawThread.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
      setChatHistory(hydratedThread);
      setConversationId(selectedHistoryTask._id);
      return;
    }

    // Case 2: It's a legacy single Task record
    setChatHistory([
      {
        id: `history-${selectedHistoryTask._id || Date.now()}`,
        prompt: selectedHistoryTask.prompt || 'Historical Run',
        result: {
          category: selectedHistoryTask.category,
          providerName: selectedHistoryTask.providerName || selectedHistoryTask.selectedEndpoint,
          executionCount: selectedHistoryTask.executionQuantity ?? 1,
          unitPrice: selectedHistoryTask.unitPrice ?? 0.45,
          executionCost: selectedHistoryTask.executionCost ?? selectedHistoryTask.endpointCost ?? 0.45,
          platformFee: selectedHistoryTask.platformFee ?? 0.75,
          totalCost: selectedHistoryTask.totalCost ?? (selectedHistoryTask.endpointCost ?? 0.45) + 0.75,
          groupTransactionId: selectedHistoryTask.groupTransactionId || selectedHistoryTask.transactionId,
          result: selectedHistoryTask.output || selectedHistoryTask.result,
          verification: { passed: selectedHistoryTask.verificationStatus === 'passed', score: 1 },
        },
        timestamp: new Date(selectedHistoryTask.createdAt || Date.now()),
      },
    ]);
    // No conversationId for legacy tasks — a new convo will be created on next prompt
    setConversationId(null);
  }, [selectedHistoryTask]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      chatScrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, loading, isPlanning, error]);

  /**
   * Persists the full chatHistory thread to MongoDB.
   * Creates a new Conversation if none exists yet (first message in session).
   * Silently no-ops on auth/network errors so it never blocks the UI.
   */
  const saveThread = async (updatedHistory: typeof chatHistory, firstPrompt?: string) => {
    try {
      // Serialize — strip File objects (content_base64 can be large; save metadata only)
      const serialized = updatedHistory.map((item) => ({
        ...item,
        files: item.files?.map((f) => ({ filename: f.filename })),
        timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp,
      }));

      let convoId = conversationId;

      if (!convoId) {
        // Create a new conversation named after the first prompt
        const title = (firstPrompt || updatedHistory[0]?.prompt || 'New Chat')
          .slice(0, 80);
        const { data } = await api.post('/api/chat/conversations', { title, thread: serialized });
        convoId = data._id;
        setConversationId(convoId);
      } else {
        // Update existing conversation thread
        await api.put(`/api/chat/conversations/${convoId}/thread`, { thread: serialized });
      }
    } catch (err) {
      // Non-fatal — user can still use the app without persistence
      console.warn('Thread save failed (non-fatal):', err);
    }
  };

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021';

  // ── Data fetching ────────────────────────────────────────────────────────────

  /** Fetch past task executions for history tab */
  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/api/analytics/tasks');
      setTasks(data);
    } catch (err) {
      console.error('Error fetching task history:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/api/chat/conversations');
      setConversations(data);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  const fetchMessages = async (convoId: string) => {
    try {
      const { data } = await api.get(`/api/chat/messages?conversationId=${convoId}`);
      setMessages(data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear wallet error automatically when wallet connects
  useEffect(() => {
    if (activeAddress && error === 'Please connect your wallet first in the top right.') {
      setError('');
    }
  }, [activeAddress, error]);

  // ── File helpers ─────────────────────────────────────────────────────────────

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await convertToBase64(file);
        newFiles.push({ filename: file.name, content_base64: base64 });
      } catch (err) {
        console.error('Error reading file:', file.name, err);
      }
    }
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Derive user's first name for greeting
  const firstName = (() => {
    const saved = localStorage.getItem('prism_logged_in_user');
    if (!saved) return 'there';
    return saved.split(' ')[0];
  })();

  // ── Phase 1: Plan ────────────────────────────────────────────────────────────

  /**
   * Submits the task for planning. Calls /plan-task (free, no payment).
   * On success, shows the Execution Summary modal.
   */
  const handleSubmitTask = async () => {
    if (!activeAddress) {
      setError('Please connect your wallet first in the top right.');
      return;
    }
    if (!taskDescription.trim()) {
      setError('Please enter a task description.');
      return;
    }
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    setIsPlanning(true);
    setError('');
    setTaskResult(null);

    try {
      // True if the current conversation already contains at least one completed task output
      const hasPriorTaskResult = chatHistory.some(
        (item) => item.result !== undefined && !item.isChatReply,
      );

      const plan = await planTask(apiBaseUrl, taskDescription, attachedFiles, hasPriorTaskResult);
      if (plan.category === 'conversational' || plan.isChat) {
        const newItem = {
          id: `msg-chat-${Date.now()}`,
          prompt: taskDescription,
          files: attachedFiles,
          reply: plan.reply || plan.message || "Hello! I'm Prism.",
          isChatReply: true as const,
          timestamp: new Date(),
        };
        setChatHistory((prev) => {
          const updated = [...prev, newItem];
          saveThread(updated, taskDescription);
          return updated;
        });
        setTaskDescription('');
        setAttachedFiles([]);
        return;
      }
      setExecutionPlan(plan);
      setShowSummaryModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Planning failed.';
      setError(msg);
      const errItem = {
        id: `msg-plan-err-${Date.now()}`,
        prompt: taskDescription,
        files: attachedFiles,
        error: msg,
        timestamp: new Date(),
      };
      setChatHistory((prev) => {
        const updated = [...prev, errItem];
        saveThread(updated, taskDescription);
        return updated;
      });
      setTaskDescription('');
      setAttachedFiles([]);
      console.error('Plan task error:', err);
    } finally {
      setIsPlanning(false);
      isProcessingRef.current = false;
    }
  };

  // ── Phase 2: Confirm & Pay ───────────────────────────────────────────────────

  /**
   * Called when the user clicks "Confirm & Pay" in the Execution Summary modal.
   *
   * Payment architecture note:
   * The x402 protocol sends one x-payment header per HTTP request. The wallet shows
   * exactly ONE popup to approve a consolidated USDC transfer covering all executions
   * (executionQuantity × unitPrice + platformFee). After approval the server executes
   * the provider once per file internally and returns a per-step progress log.
   */
  const handleConfirmAndPay = async (filteredFiles: AttachedFile[], updatedPlan: ExecutionPlan) => {
    if (!executionPlan || !activeAddress || !signTransactions) return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    setShowSummaryModal(false);
    setLoading(true);
    setError('');

    const total = updatedPlan.executionQuantity;
    const category = updatedPlan.category;

    // Show payment-approval phase immediately
    setExecProgress({ current: 1, total, category, phase: 'payment' });
    setPaymentStatus(`Requesting USDC payment approval…`);

    try {
      const signer = { address: activeAddress, signTransactions };

      const data = await executeTaskWithPayment(
        apiBaseUrl,
        updatedPlan,
        taskDescription,
        filteredFiles,
        signer,
        (current, phase) => {
          setExecProgress({
            current,
            total,
            category,
            phase,
            currentFilename: updatedPlan.paymentPreview?.find(
              (p) => p.type === 'execution' && p.index === current
            )?.filename,
          });
          if (phase === 'payment') {
            setPaymentStatus(`Requesting payment for execution #${current}…`);
          } else if (phase === 'executing') {
            setPaymentStatus(`Executing work for execution #${current}…`);
          } else if (phase === 'verifying') {
            setPaymentStatus(`Verifying and aggregating all results…`);
          } else if (phase === 'completed') {
            setPaymentStatus(`Completed successfully.`);
          }
        }
      );

      // Show verifying phase briefly before showing completed
      setExecProgress({ current: total, total, category, phase: 'verifying' });
      await new Promise((r) => setTimeout(r, 700));

      setExecProgress({ current: total, total, category, phase: 'completed' });
      await new Promise((r) => setTimeout(r, 500));

      setPaymentStatus('');
      setTaskResult(data);
      setExecProgress(null);

      // Append successful execution item to persistent chatHistory
      const taskItem = {
        id: `msg-${Date.now()}`,
        prompt: taskDescription,
        files: attachedFiles,
        result: data,
        timestamp: new Date(),
      };
      setChatHistory((prev) => {
        const updated = [...prev, taskItem];
        saveThread(updated, taskDescription);
        return updated;
      });
      setTaskDescription('');
      setAttachedFiles([]);

      fetchTasks();
      if (onTaskComplete) onTaskComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error.';
      setError(msg);
      setPaymentStatus('');
      setExecProgress(null);

      const errItem2 = {
        id: `msg-err-${Date.now()}`,
        prompt: taskDescription,
        files: attachedFiles,
        error: msg,
        timestamp: new Date(),
      };
      setChatHistory((prev) => {
        const updated = [...prev, errItem2];
        saveThread(updated, taskDescription);
        return updated;
      });
      setTaskDescription('');
      setAttachedFiles([]);
      console.error('Execute task error:', err);
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleCancelSummary = () => {
    setShowSummaryModal(false);
    setExecutionPlan(null);
  };

  // ── Chat helpers ─────────────────────────────────────────────────────────────

  const handleCreateConvo = async () => {
    try {
      const title = `Chat - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const { data } = await api.post('/api/chat/conversations', { title });
      setConversations((prev) => [data, ...prev]);
      setSelectedConvo(data);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create conversation', err);
    }
  };

  const handleSelectConvo = async (convo: any) => {
    setSelectedConvo(convo);
    await fetchMessages(convo._id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedConvo) return;

    const text = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    try {
      const { data: userMsg } = await api.post('/api/chat/messages', {
        conversationId: selectedConvo._id,
        role: 'user',
        content: text,
      });
      setMessages((prev) => [...prev, userMsg]);

      setTimeout(async () => {
        try {
          const replyText = `I'm your Prism routing assistant. I analyzed: "${text}". For routing tasks, use the Terminal tab. For questions, ask away!`;
          const { data: assistantMsg } = await api.post('/api/chat/messages', {
            conversationId: selectedConvo._id,
            role: 'assistant',
            content: replyText,
          });
          setMessages((prev) => [...prev, assistantMsg]);
        } catch (err) {
          console.error(err);
        } finally {
          setChatLoading(false);
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to send message:', err);
      setChatLoading(false);
    }
  };

  // ── Result renderers ─────────────────────────────────────────────────────────

  const renderFormattedResult = (result: any, category: string) => {
    if (!result) return <p className="text-slate-400 text-xs">No data returned.</p>;

    if (category === 'resume_screening' && result.candidates) {
      return (
        <div className="overflow-x-auto w-full">
          <table className="table w-full text-slate-300">
            <thead>
              <tr className="text-indigo-400 border-b border-slate-800/80">
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Candidate Name</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Target/Matched Role</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Match Score</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Primary Domain</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Alternative Fits</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Key Skills</th>
              </tr>
            </thead>
            <tbody>
              {result.candidates.map((c: any, index: number) => {
                const scorePercent = Math.round((c.match_score || 0) * 100);
                let progressClass = 'progress-success';
                if (c.match_score < 0.4) progressClass = 'progress-error';
                else if (c.match_score < 0.7) progressClass = 'progress-warning';
                return (
                  <tr key={index} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="font-semibold text-white">{c.name}</td>
                    <td className="text-slate-300">{c.role || 'N/A'}</td>
                    <td className="w-1/6">
                      <div className="flex items-center gap-2">
                        <progress className={`progress ${progressClass} w-16 bg-slate-800`} value={scorePercent} max="100" />
                        <span className="font-extrabold text-xs text-slate-200">{scorePercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[150px]">
                      <span className="inline-block px-2 py-1 rounded-md border border-emerald-500/20 text-emerald-300 bg-emerald-950/25 text-[11px] font-semibold leading-relaxed break-words">
                        {c.primary_domain || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[200px]">
                      <div className="flex flex-wrap gap-x-1.5 gap-y-2">
                        {Array.isArray(c.alternative_roles) && c.alternative_roles.length > 0 ? (
                          c.alternative_roles.map((alt: string, aIdx: number) => (
                            <span key={aIdx} className="inline-flex items-center px-2 py-1 rounded-md border border-sky-500/20 text-sky-300 bg-sky-950/25 text-[10px] font-medium leading-normal break-words text-left">
                              {alt}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-xs">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[250px]">
                      <div className="flex flex-wrap gap-x-1.5 gap-y-2">
                        {Array.isArray(c.key_skills) && c.key_skills.length > 0 ? (
                          c.key_skills.map((skill: string, sIdx: number) => (
                            <span key={sIdx} className="inline-flex items-center px-2 py-1 rounded-md border border-indigo-500/20 text-indigo-300 bg-indigo-950/25 text-[10px] font-medium leading-normal break-words text-left">
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-xs">None</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium pl-3 pb-1 border-t border-slate-800/20 pt-2">
            <span className="info-icon text-indigo-400 font-bold">ℹ</span>
            <span>How is the Match Score calculated? The score represents semantic similarity and skill overlap computed by the LLM based on keyword presence, experience level, skill relevance weight, and target role criteria.</span>
          </div>
        </div>
      );
    }

    if (category === 'contract_analysis') {
      const clauses = result.clauses ?? result.documents?.flatMap((d: any) => d.clauses ?? []) ?? [];
      if (clauses.length > 0) {
        return (
          <div className="flex flex-col gap-3 w-full">
            {clauses.map((clause: any, index: number) => {
              let badgeColor = 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400';
              if (clause.risk?.toLowerCase() === 'high') badgeColor = 'bg-rose-500/15 border-rose-500/25 text-rose-400';
              else if (clause.risk?.toLowerCase() === 'medium') badgeColor = 'bg-amber-500/15 border-amber-500/25 text-amber-400';
              return (
                <div key={index} className="collapse collapse-arrow bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                  <input type="checkbox" defaultChecked={index === 0} />
                  <div className="collapse-title text-sm font-semibold flex items-center gap-3 text-white pr-10">
                    <span className={`badge ${badgeColor} border badge-sm uppercase font-extrabold tracking-wider`}>{clause.risk || 'Low'}</span>
                    <span className="text-slate-250 font-bold">{clause.type || 'Clause'}</span>
                  </div>
                  <div className="collapse-content text-slate-300 text-xs flex flex-col gap-2">
                    {clause.clause_text && (
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 font-mono mt-1 text-slate-350">
                        <strong>Clause Text:</strong> {clause.clause_text}
                      </div>
                    )}
                    {clause.description && <div className="mt-1 text-slate-300"><strong>Description:</strong> {clause.description}</div>}
                    {clause.mitigation && (
                      <div className="bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-900/30 text-indigo-300 mt-1">
                        <strong>Recommendation:</strong> {clause.mitigation}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }

    if (category === 'code_review' && result) {
      const files = result.files ?? (result.file_path ? [result] : []);
      const totalFiles = result.totalFilesReviewed ?? files.length;
      const totalIssues = result.totalIssues ?? files.reduce((sum: number, f: any) => sum + (f.issues?.length || 0), 0);
      const severity = result.issuesBySeverity ?? {
        low: files.flatMap((f: any) => f.issues ?? []).filter((i: any) => i.severity === 'low').length,
        medium: files.flatMap((f: any) => f.issues ?? []).filter((i: any) => i.severity === 'medium').length,
        high: files.flatMap((f: any) => f.issues ?? []).filter((i: any) => i.severity === 'high').length,
      };
      const avgScore = Math.round((result.averageQualityScore ?? (result.overall_quality_score ?? 0.85)) * 100);

      return (
        <div className="flex flex-col gap-4 w-full text-slate-300">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Reviewed Files</span>
              <span className="text-xl font-black text-white">{totalFiles}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Issues</span>
              <span className="text-xl font-black text-amber-400">{totalIssues}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Severity Breakdown</span>
              <div className="flex gap-2 text-xs font-bold mt-1">
                <span className="text-rose-400">{severity.high} High</span>
                <span className="text-amber-400">{severity.medium} Med</span>
                <span className="text-emerald-400">{severity.low} Low</span>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Quality Score</span>
              <span className="text-xl font-black text-emerald-400">{avgScore}%</span>
            </div>
          </div>

          {/* Per-File Issues List */}
          <div className="flex flex-col gap-3 w-full mt-1">
            {files.map((f: any, index: number) => {
              const fileIssues = f.issues || [];
              const scorePct = Math.round((f.overall_quality_score ?? 0.85) * 100);
              return (
                <div key={index} className="collapse collapse-arrow bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                  <input type="checkbox" defaultChecked={index === 0} />
                  <div className="collapse-title text-sm font-semibold flex items-center justify-between text-white pr-10">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-indigo-400 font-bold">📄 {f.file_path}</span>
                      <span className="text-xs text-slate-400">({fileIssues.length} issue{fileIssues.length !== 1 ? 's' : ''})</span>
                    </div>
                    <span className="badge bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-2 py-0.5">
                      Quality: {scorePct}%
                    </span>
                  </div>
                  <div className="collapse-content text-slate-300 text-xs flex flex-col gap-3 pt-2">
                    {fileIssues.length > 0 ? (
                      fileIssues.map((issue: any, iIdx: number) => {
                        let badgeColor = 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400';
                        if (issue.severity === 'high') badgeColor = 'bg-rose-500/15 border-rose-500/25 text-rose-400';
                        else if (issue.severity === 'medium') badgeColor = 'bg-amber-500/15 border-amber-500/25 text-amber-400';
                        return (
                          <div key={iIdx} className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/60 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`badge ${badgeColor} border text-[10px] font-extrabold uppercase px-2 py-0.5`}>
                                {issue.severity || 'low'}
                              </span>
                              {issue.line_estimate && (
                                <span className="font-mono text-[11px] text-slate-400">Line ~{issue.line_estimate}</span>
                              )}
                            </div>
                            <p className="text-slate-200 font-medium text-xs leading-relaxed">{issue.description}</p>
                            {issue.suggestion && (
                              <div className="bg-indigo-950/30 border border-indigo-900/30 p-2.5 rounded-lg text-indigo-300 text-[11px] mt-1 font-mono">
                                <strong>Suggestion:</strong> {issue.suggestion}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-500 text-xs py-1">No code issues or vulnerabilities detected for this file.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (category === 'invoice_extraction') {
      const lineItems = result.line_items ?? result.documents?.flatMap((d: any) => d.line_items ?? []) ?? [];
      const vendorName = result.vendor_name || result.documents?.[0]?.vendor_name || 'N/A';
      const invoiceNumber = result.invoice_number || result.documents?.[0]?.invoice_number || 'N/A';
      const invoiceDate = result.date || result.documents?.[0]?.date || 'N/A';

      if (lineItems.length > 0 || result.vendor_name || result.total_amount !== undefined) {
        const totalAmount = typeof result.total_amount === 'number'
          ? result.total_amount
          : lineItems.reduce((sum: number, item: any) => sum + (Number(item.amount || item.total) || 0), 0);

        return (
          <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 font-medium block text-[10px] uppercase">Vendor</span>
                <span className="font-bold text-white">{vendorName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block text-[10px] uppercase">Invoice #</span>
                <span className="font-mono text-slate-200">{invoiceNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block text-[10px] uppercase">Date</span>
                <span className="text-slate-200">{invoiceDate}</span>
              </div>
            </div>

            {lineItems.length > 0 ? (
              <div className="overflow-x-auto w-full">
                <table className="table w-full text-slate-300">
                  <thead>
                    <tr className="text-indigo-400 border-b border-slate-800/80">
                      {lineItems[0]?.item_code !== undefined && <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Item Code</th>}
                      <th className="bg-transparent text-xs font-bold uppercase tracking-wider">Description</th>
                      {lineItems[0]?.quantity !== undefined && <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-right">Qty</th>}
                      {lineItems[0]?.unit_price !== undefined && <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-right">Unit Price</th>}
                      <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                        {item.item_code !== undefined && <td className="font-mono text-xs text-slate-400">{item.item_code}</td>}
                        <td className="text-white">{item.description}</td>
                        {item.quantity !== undefined && <td className="text-right text-slate-300">{item.quantity}</td>}
                        {item.unit_price !== undefined && <td className="text-right text-slate-300">${Number(item.unit_price).toFixed(2)}</td>}
                        <td className="text-right font-semibold text-white">${Number(item.amount || item.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-slate-800 bg-indigo-950/20 text-indigo-300">
                      <td colSpan={lineItems[0]?.quantity !== undefined ? 4 : 2} className="text-right">Total:</td>
                      <td className="text-right font-extrabold text-white text-base">${totalAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/30 rounded-xl border border-slate-800/50 text-xs text-slate-400">
                No individual line items extracted. Total Amount: <strong className="text-white">${totalAmount.toFixed(2)}</strong>
              </div>
            )}
          </div>
        );
      }
    }

    return (
      <div className="mockup-code bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-xl shadow-inner border border-slate-700/50">
        <pre className="text-xs overflow-auto max-h-60 font-mono text-emerald-300 leading-relaxed">
          <code className="whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</code>
        </pre>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col items-center">

      {/* ── Execution Summary Modal ── */}
      {showSummaryModal && executionPlan && (
        <ExecutionSummaryModal
          plan={executionPlan}
          files={attachedFiles}
          onConfirm={(filteredFiles, updatedPlan) => {
            handleConfirmAndPay(filteredFiles, updatedPlan);
          }}
          onCancel={handleCancelSummary}
        />
      )}

      {/* ── TERMINAL TAB ── */}
      {activeTab === 'terminal' && (
        <div className={`w-full flex flex-col items-center relative ${chatHistory.length > 0 ? 'justify-between min-h-screen pt-24 pb-36' : 'justify-center min-h-[calc(100vh-80px)]'}`}>

          {/* Initial Hero Container (Greeting + Centered Input Box when no chat history exists) */}
          {chatHistory.length === 0 && !loading && !isPlanning && (
            <div className="w-full max-w-4xl animate-fade-in flex flex-col items-center justify-center gap-8 my-auto">
              <div className="text-center">
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
                  Hi {firstName}, I'm Prism.
                </h1>
                <p className="text-xl text-indigo-300 font-medium">
                  What do you need done?
                </p>
              </div>

              {/* Centered Initial Input Box */}
              <div className="w-full max-w-3xl liquid-glass p-5 flex flex-col gap-4 shadow-2xl border border-indigo-500/20 rounded-3xl">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="badge badge-lg gap-2 bg-indigo-950/60 border border-indigo-900/50 text-indigo-300 px-3 py-3 rounded-full text-xs font-medium"
                      >
                        <span>{file.filename}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="hover:bg-indigo-900/50 rounded-full p-0.5 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 w-full">
                  {/* Attach file */}
                  <button
                    type="button"
                    className="btn btn-circle btn-ghost text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 transition-colors shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || isPlanning}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                  />

                  {/* Textarea — Increased Height */}
                  <div className="flex-1 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2 flex shadow-inner">
                    <textarea
                      className="textarea textarea-ghost focus:bg-transparent resize-none flex-1 py-3 px-4 text-slate-100 placeholder-slate-500 text-sm focus:outline-none min-h-[120px] h-[120px] leading-relaxed"
                      placeholder="e.g. Screen these resumes for a Senior Full Stack Engineer role, or analyze vendor invoices for line items."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      disabled={loading || isPlanning}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitTask();
                        }
                      }}
                    />
                  </div>

                  {/* Send */}
                  <button
                    className={`btn btn-circle shrink-0 ${
                      !taskDescription.trim() || loading || isPlanning
                        ? 'btn-ghost text-slate-700'
                        : 'btn-primary text-white scale-105 shadow-md shadow-indigo-500/20'
                    } transition-all duration-200`}
                    onClick={handleSubmitTask}
                    disabled={!taskDescription.trim() || loading || isPlanning}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 3 Suggested Inputs Pills — Placed BELOW the Chatbox Container */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-3xl">
                {[
                  { label: "📄 Screen Resumes", text: "Screen these candidate resumes for a Senior Backend Developer role" },
                  { label: "📜 Analyze Contract", text: "Review this NDA contract and flag any high risk termination clauses" },
                  { label: "🧾 Extract Invoice Data", text: "Extract vendor name, line items, and total amount from this invoice" }
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-sm rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25 hover:border-indigo-400 hover:text-white transition-all text-xs px-4 py-2 font-semibold shadow-lg backdrop-blur-md hover:scale-105"
                    onClick={() => setTaskDescription(suggestion.text)}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Persistent Scrollable Message History Area */}
          {chatHistory.length > 0 && (
            <div className="w-full max-w-4xl flex flex-col gap-6 w-full">
              {chatHistory.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 w-full animate-fade-in">
                  
                  {/* User Message Bubble */}
                  <div className="flex justify-end w-full">
                    <div className="bg-indigo-600/90 text-white rounded-2xl rounded-tr-sm px-5 py-3 text-sm max-w-[80%] shadow-lg border border-indigo-400/30 flex flex-col gap-1.5">
                      <p className="whitespace-pre-wrap leading-relaxed">{item.prompt}</p>
                      {item.files && item.files.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-indigo-400/20">
                          {item.files.map((f, fIdx) => (
                            <span key={fIdx} className="text-[10px] bg-indigo-950/60 text-indigo-200 px-2 py-0.5 rounded-full font-mono border border-indigo-400/20">
                              📎 {f.filename}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assistant / Execution Result Output Bubble */}
                  {item.result && (
                    <div className="flex justify-start w-full">
                      <div className="w-full liquid-glass p-5 rounded-2xl shadow-xl border border-slate-800/80 flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                              Execution Result Output
                            </h4>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-800/60">
                            {item.result.category}
                          </span>
                        </div>

                        {/* Metadata Bar */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <div className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                            <FiCheckCircle className="text-xs" />
                            Payment Verified · {item.result.executionCount ?? 1} execution(s)
                          </div>
                          <div className="flex items-center gap-1 text-indigo-300 font-semibold bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1">
                            <FiDollarSign className="text-xs" />
                            ${(item.result.totalCost ?? 0).toFixed(2)} USDC
                          </div>
                          {item.result.groupTransactionId && (
                            <div className="flex items-center gap-1 text-slate-400 font-mono bg-slate-900/60 border border-slate-800/60 rounded-lg px-2.5 py-1">
                              <FiLink className="text-xs shrink-0" />
                              Tx: {item.result.groupTransactionId.slice(0, 8)}…{item.result.groupTransactionId.slice(-6)}
                            </div>
                          )}
                        </div>

                        {/* Efficiency breakdown */}
                        {item.result.savings_this_request && (
                          <div className="px-3 py-2 bg-slate-900/60 border border-slate-800/60 rounded-xl text-xs text-slate-300 flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-medium">Token Savings:</span>
                              <span className="text-emerald-400 font-bold">
                                {Math.round(item.result.savings_this_request.reduction_percent ?? 0)}% fewer tokens
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              You paid ${(item.result.totalCost ?? 0.75).toFixed(2)} — saved ~${(item.result.savings_this_request.estimated_usd_saved ?? 0.05).toFixed(2)}. ({item.result.savings_this_request.savings_multiplier ?? 2.8}x efficiency).
                            </p>
                          </div>
                        )}

                        {/* Formatted result content */}
                        <div className="w-full bg-slate-950/40 rounded-xl border border-slate-800/60 p-3.5 mt-1">
                          {renderFormattedResult(item.result.result, item.result.category)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assistant / Conversational Reply Bubble */}
                  {(item.reply || item.isChatReply) && (
                    <div className="flex justify-start w-full">
                      <div className="bg-slate-900/90 text-slate-100 rounded-2xl rounded-tl-sm px-5 py-3 text-sm max-w-[80%] shadow-lg border border-slate-800/80 flex items-start gap-3">
                        <img src="/icon.png" alt="Prism" className="w-6 h-6 rounded-full object-contain shrink-0 mt-0.5" />
                        <p className="whitespace-pre-wrap leading-relaxed flex-1">{item.reply}</p>
                      </div>
                    </div>
                  )}

                  {/* Assistant / Error Response Bubble */}
                  {item.error && (
                    <div className="flex justify-start w-full">
                      <div className={`p-4 rounded-2xl border text-xs max-w-[85%] leading-relaxed flex items-center gap-3 ${
                        item.error.includes("I'm not sure what you'd like done")
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      }`}>
                        <span className="text-base">{item.error.includes("I'm not sure what you'd like done") ? '💡' : '⚠️'}</span>
                        <div className="flex-1">{item.error}</div>
                      </div>
                    </div>
                  )}

                </div>
              ))}
              <div ref={chatScrollBottomRef} />
            </div>
          )}

          {/* Planning Indicator */}
          {isPlanning && (
            <div className="text-center my-4 flex flex-col items-center justify-center animate-fade-in">
              <div className="loading loading-spinner loading-lg text-indigo-400 mb-3" />
              <h2 className="text-xl font-bold text-indigo-300 animate-pulse">Analysing task & discovering providers…</h2>
              <p className="text-xs text-slate-500 mt-1">Computing optimal routing and pricing</p>
            </div>
          )}

          {/* Execution Progress */}
          {loading && execProgress && (
            <ExecutionProgress
              current={execProgress.current}
              total={execProgress.total}
              category={execProgress.category}
              phase={execProgress.phase}
              currentFilename={execProgress.currentFilename}
            />
          )}

          {/* Payment status loading */}
          {loading && !execProgress && (
            <div className="text-center my-4 flex flex-col items-center justify-center">
              <div className="loading loading-spinner loading-lg text-primary mb-3" />
              <h2 className="text-2xl font-bold text-indigo-700 animate-pulse">Prism is working…</h2>
              {paymentStatus && <span className="text-sm text-slate-500 mt-1">{paymentStatus}</span>}
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div className={`w-full max-w-2xl mb-4 p-4 rounded-2xl border text-sm flex items-center gap-3 animate-fade-in ${
              error.includes("I'm not sure what you'd like done")
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            }`}>
              <div className="shrink-0 text-base font-bold">
                {error.includes("I'm not sure what you'd like done") ? '💡' : '⚠️'}
              </div>
              <div className="flex-1 leading-relaxed">{error}</div>
              <button
                className="btn btn-ghost btn-xs text-slate-400 hover:text-white rounded-full"
                onClick={() => setError('')}
              >
                ✕
              </button>
            </div>
          )}

          {/* Persistent Input Bar — fixed at bottom after conversation starts or during task execution */}
          {(chatHistory.length > 0 || loading || isPlanning) && (
            <div className="w-full max-w-3xl fixed bottom-6 left-1/2 -translate-x-1/2 z-40 liquid-glass p-4 flex flex-col gap-3 shadow-2xl border border-indigo-500/20 animate-fade-in">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-1">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="badge badge-lg gap-2 bg-indigo-950/60 border border-indigo-900/50 text-indigo-300 px-3 py-3 rounded-full text-xs font-medium"
                  >
                    <span>{file.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="hover:bg-indigo-900/50 rounded-full p-0.5 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 w-full">
              {/* Attach file */}
              <button
                type="button"
                className="btn btn-circle btn-ghost text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 transition-colors shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isPlanning}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
              />

              {/* Textarea */}
              <div className="flex-1 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-1.5 flex shadow-inner">
                <textarea
                  className="textarea textarea-ghost focus:bg-transparent resize-none flex-1 py-2.5 px-4 text-slate-100 placeholder-slate-500 text-sm focus:outline-none min-h-[50px] h-[50px] leading-normal"
                  placeholder="e.g. Screen these resumes for a backend engineer role"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  disabled={loading || isPlanning}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitTask();
                    }
                  }}
                />
              </div>

              {/* Send */}
              <button
                className={`btn btn-circle shrink-0 ${
                  !taskDescription.trim() || loading || isPlanning
                    ? 'btn-ghost text-slate-700'
                    : 'btn-primary text-white scale-105 shadow-md shadow-indigo-500/20'
                } transition-all duration-200`}
                onClick={handleSubmitTask}
                disabled={!taskDescription.trim() || loading || isPlanning}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}

        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="w-full flex flex-col gap-4">
          <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Historical Run Logs</h2>
          {tasks.length === 0 ? (
            <p className="text-slate-500 text-sm">No tasks have been run yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Category</th>
                    <th>Provider</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Exec Cost</th>
                    <th>Platform Fee</th>
                    <th>Total</th>
                    <th>Latency</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task._id}>
                      <td className="max-w-[200px] truncate" title={task.prompt}>{task.prompt}</td>
                      <td><span className="admin-badge admin-badge--indigo">{task.category}</span></td>
                      <td className="font-mono text-[10px]">{task.providerName || task.selectedEndpoint || 'N/A'}</td>
                      <td className="text-center">{task.executionQuantity ?? 1}</td>
                      <td>${(task.unitPrice ?? 0).toFixed(2)}</td>
                      <td>${(task.executionCost ?? task.endpointCost ?? 0).toFixed(2)}</td>
                      <td>${(task.platformFee ?? 0.75).toFixed(2)}</td>
                      <td className="font-bold text-emerald-400">${(task.totalCost ?? 0).toFixed(2)}</td>
                      <td>{task.executionTime ? `${task.executionTime}ms` : 'N/A'}</td>
                      <td>
                        <span className={`admin-badge ${task.verificationStatus === 'passed' ? 'admin-badge--green' : task.verificationStatus === 'failed' ? 'admin-badge--rose' : 'admin-badge--slate'}`}>
                          {task.verificationStatus || 'unverified'}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-badge ${task.refundIssued || task.verificationStatus === 'failed' ? 'admin-badge--rose' : task.status === 'completed' ? 'admin-badge--green' : 'admin-badge--slate'}`}>
                          {task.refundIssued || task.verificationStatus === 'failed'
                            ? `Refunded ($${(task.refundAmount ?? task.totalCost ?? task.endpointCost ?? 0.75).toFixed(2)})`
                            : task.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-xs btn-outline btn-primary rounded-lg text-[10px]"
                          onClick={() => {
                            setTaskResult(task.output ? { ...task, result: task.output } : task);
                            setActiveTab('terminal');
                          }}
                        >
                          View Output
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CHATS TAB ── */}
      {activeTab === 'chats' && (
        <div className="w-full flex gap-6 h-[500px]">
          {/* Convo Sidebar */}
          <div className="w-1/3 liquid-glass flex flex-col p-4 gap-4 h-full">
            <button
              className="btn btn-primary rounded-xl w-full flex items-center justify-center gap-2 font-bold text-xs uppercase"
              onClick={handleCreateConvo}
            >
              <FiPlus /> New Chat
            </button>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2">
              {conversations.map((convo) => (
                <div
                  key={convo._id}
                  onClick={() => handleSelectConvo(convo)}
                  className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-2.5 text-xs font-semibold ${
                    selectedConvo?._id === convo._id
                      ? 'bg-indigo-500/15 border border-indigo-500/35 text-white'
                      : 'bg-slate-900/30 border border-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FiMessageSquare className="text-sm shrink-0" />
                  <span className="truncate">{convo.title}</span>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-slate-500 text-center text-xs py-10">No chats started.</p>
              )}
            </div>
          </div>

          {/* Conversation Screen */}
          <div className="w-2/3 liquid-glass flex flex-col p-4 h-full">
            {selectedConvo ? (
              <>
                <div className="border-b border-slate-800 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">{selectedConvo.title}</h3>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 mb-4">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg._id}
                        className={`flex flex-col max-w-[80%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                      >
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-indigo-500 text-white rounded-br-none'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  {chatLoading && (
                    <div className="self-start flex gap-2 items-center text-xs text-slate-400 font-medium">
                      <span className="loading loading-dots loading-sm text-indigo-500" />
                      Assistant is thinking…
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatLoading}
                    placeholder="Ask Prism routing assistant…"
                    className="input bg-slate-950/60 border-slate-800 focus:border-indigo-500 focus:outline-none flex-1 text-xs px-4"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || chatLoading}
                    className="btn btn-primary btn-square rounded-xl text-white"
                  >
                    <FiSend className="text-sm" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-6">
                <FiMessageSquare className="text-4xl text-slate-700 mb-3" />
                <p className="text-sm font-semibold">No Conversation Selected</p>
                <p className="text-xs text-slate-600 mt-1">Start a new chat to ask Prism assistant questions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error mt-4 max-w-xl animate-shake">
          <div className="flex gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Weather;
