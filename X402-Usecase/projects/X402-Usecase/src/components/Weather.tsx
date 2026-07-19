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
}

// ─── Execution Summary Modal ──────────────────────────────────────────────────

interface ExecutionSummaryModalProps {
  plan: ExecutionPlan;
  files: AttachedFile[];
  onConfirm: () => void;
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
  };

  const accuracyPct = Math.round((plan.estimatedAccuracy ?? 0) * 100);
  const preview: PaymentPreviewItem[] = plan.paymentPreview ?? [];

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
              value: `${plan.executionQuantity} file${plan.executionQuantity !== 1 ? 's' : ''}`,
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
                {preview.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      {item.type === 'platform_fee' ? (
                        <span className="w-5 h-5 rounded bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-[9px] font-black text-violet-400">₱</span>
                      ) : (
                        <span className="w-5 h-5 rounded bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-[9px] font-black text-indigo-400">
                          {item.index}
                        </span>
                      )}
                      <span className="text-xs text-slate-300 font-medium truncate max-w-[220px]">{item.label}</span>
                    </div>
                    <span className={`text-xs font-bold ${item.type === 'platform_fee' ? 'text-violet-300' : 'text-emerald-300'}`}>
                      ${item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
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
              <span className="text-2xl font-black text-white">${plan.totalCost.toFixed(2)}</span>
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
            onClick={onConfirm}
          >
            Confirm &amp; Pay ${plan.totalCost.toFixed(2)}
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

const Weather: React.FC<WeatherProps> = ({ activeTab, setActiveTab, onTaskComplete }) => {
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

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    setIsPlanning(true);
    setError('');
    setTaskResult(null);

    try {
      const plan = await planTask(apiBaseUrl, taskDescription, attachedFiles);
      setExecutionPlan(plan);
      setShowSummaryModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Planning failed.';
      setError(msg);
      console.error('Plan task error:', err);
    } finally {
      setIsPlanning(false);
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
  const handleConfirmAndPay = async () => {
    if (!executionPlan || !activeAddress || !signTransactions) return;

    setShowSummaryModal(false);
    setLoading(true);
    setError('');

    const total = executionPlan.executionQuantity;
    const category = executionPlan.category;

    // Show payment-approval phase immediately
    setExecProgress({ current: 0, total, category, phase: 'payment' });
    setPaymentStatus(`Requesting $${executionPlan.totalCost.toFixed(2)} USDC approval…`);

    try {
      const signer = { address: activeAddress, signTransactions };

      // Kick off per-file progress simulation while waiting for the server.
      // Each file gets ~equal time share. We advance through 'executing' phase steps.
      let progressCount = 0;
      const stepMs = Math.max(600, (executionPlan.estimatedTimeSeconds * 1000) / (total + 2));

      const progressInterval = setInterval(() => {
        progressCount += 1;
        if (progressCount <= total) {
          setExecProgress({
            current: progressCount,
            total,
            category,
            phase: 'executing',
            currentFilename: executionPlan.paymentPreview?.find(
              (p) => p.type === 'execution' && p.index === progressCount
            )?.filename,
          });
        } else {
          setExecProgress({ current: total, total, category, phase: 'verifying' });
          clearInterval(progressInterval);
        }
      }, stepMs);

      const data = await executeTaskWithPayment(
        apiBaseUrl,
        executionPlan.planId,
        taskDescription,
        attachedFiles,
        signer,
      );

      clearInterval(progressInterval);

      // Show verifying phase briefly before showing completed
      setExecProgress({ current: total, total, category, phase: 'verifying' });
      await new Promise((r) => setTimeout(r, 700));

      setExecProgress({ current: total, total, category, phase: 'completed' });
      await new Promise((r) => setTimeout(r, 500));

      setPaymentStatus('');
      setTaskResult(data);
      setExecProgress(null);

      fetchTasks();
      if (onTaskComplete) onTaskComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error.';
      setError(msg);
      setPaymentStatus('');
      setExecProgress(null);
      console.error('Execute task error:', err);
    } finally {
      setLoading(false);
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
                    <td className="w-1/4">
                      <div className="flex items-center gap-2">
                        <progress className={`progress ${progressClass} w-20 bg-slate-800`} value={scorePercent} max="100" />
                        <span className="font-extrabold text-xs text-slate-200">{scorePercent}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(c.key_skills) && c.key_skills.length > 0 ? (
                          c.key_skills.map((skill: string, sIdx: number) => (
                            <span key={sIdx} className="badge badge-sm badge-outline border-indigo-500/30 text-indigo-300 bg-indigo-950/20">{skill}</span>
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

    if (category === 'invoice_extraction') {
      const lineItems = result.line_items ?? result.documents?.flatMap((d: any) => d.line_items ?? []) ?? [];
      if (lineItems.length > 0) {
        const totalAmount = lineItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
        return (
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
                    <td className="text-right font-semibold text-white">${Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t border-slate-800 bg-indigo-950/20 text-indigo-300">
                  <td colSpan={lineItems[0]?.quantity !== undefined ? 4 : 2} className="text-right">Total:</td>
                  <td className="text-right font-extrabold text-white text-base">${totalAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
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
    <div className="w-full flex flex-col items-center py-6">

      {/* ── Execution Summary Modal ── */}
      {showSummaryModal && executionPlan && (
        <ExecutionSummaryModal
          plan={executionPlan}
          files={attachedFiles}
          onConfirm={handleConfirmAndPay}
          onCancel={handleCancelSummary}
        />
      )}

      {/* ── TERMINAL TAB ── */}
      {activeTab === 'terminal' && (
        <div className="w-full flex flex-col items-center">

          {/* Greeting */}
          {!taskResult && !loading && !isPlanning && (
            <div className="text-center mb-8 animate-fade-in">
              <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
                Hi {firstName}, I'm Prism.
              </h1>
              <p className="text-xl text-indigo-300 font-medium">
                What do you need done?
              </p>
            </div>
          )}

          {/* Planning Indicator */}
          {isPlanning && (
            <div className="text-center mb-8 flex flex-col items-center justify-center animate-fade-in">
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

          {/* Payment status (non-progress loading) */}
          {loading && !execProgress && (
            <div className="text-center mb-8 flex flex-col items-center justify-center">
              <div className="loading loading-spinner loading-lg text-primary mb-3" />
              <h2 className="text-2xl font-bold text-indigo-700 animate-pulse">Prism is working…</h2>
              {paymentStatus && <span className="text-sm text-slate-500 mt-1">{paymentStatus}</span>}
            </div>
          )}

          {/* Result Block */}
          {taskResult && !loading && (
            <div className="w-full liquid-glass p-6 mb-8 animate-fade-in">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800/50 pb-3">
                <h3 className="text-lg font-bold text-indigo-400">Task Execution Output</h3>
                <button
                  className="btn btn-ghost btn-xs text-slate-400 hover:text-slate-200 rounded-full"
                  onClick={() => setTaskResult(null)}
                >
                  Clear Result
                </button>
              </div>

              {/* Payment / transaction metadata bar */}
              <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-2.5 py-1.5">
                  <FiCheckCircle className="text-xs" />
                  Payment Verified · {taskResult.executionCount ?? taskResult.executionQuantity} execution{(taskResult.executionCount ?? 1) !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-semibold bg-indigo-500/8 border border-indigo-500/15 rounded-lg px-2.5 py-1.5">
                  <FiDollarSign className="text-xs" />
                  ${(taskResult.totalCost ?? 0).toFixed(2)} USDC · Consolidated tx
                </div>
                {taskResult.groupTransactionId && (
                  <div
                    className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono bg-slate-900/60 border border-slate-800/60 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-slate-800/60 transition-colors"
                    title={taskResult.groupTransactionId}
                    onClick={() => navigator.clipboard?.writeText(taskResult.groupTransactionId)}
                  >
                    <FiLink className="text-xs shrink-0" />
                    Tx: {taskResult.groupTransactionId.length > 20
                      ? `${taskResult.groupTransactionId.slice(0, 10)}…${taskResult.groupTransactionId.slice(-8)}`
                      : taskResult.groupTransactionId}
                  </div>
                )}
              </div>

              {/* Formatted result table / cards */}
              <div className="w-full mt-2 bg-slate-950/40 rounded-xl border border-slate-800/60 p-4">
                {renderFormattedResult(taskResult.result, taskResult.category)}
              </div>
            </div>
          )}

          {/* Input Area (only shown when no taskResult is present) */}
          {!taskResult && (
            <div className="w-full liquid-glass p-5 flex flex-col gap-3">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2 mb-1">
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

              <div className="flex items-center gap-4 w-full">
                {/* Attach file */}
                <button
                  type="button"
                  className="btn btn-circle btn-ghost text-slate-400 hover:text-indigo-450 hover:bg-slate-800/50 transition-colors shrink-0"
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
                    className="textarea textarea-ghost focus:bg-transparent resize-none flex-1 py-3 px-4 text-slate-100 placeholder-slate-500 text-sm focus:outline-none min-h-[100px] h-[100px] leading-normal"
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
                      : 'btn-primary text-white scale-105'
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
                        <span className={`admin-badge ${task.status === 'completed' ? 'admin-badge--green' : 'admin-badge--rose'}`}>
                          {task.status}
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
