import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  planTask,
  executeTaskWithPayment,
  analyzePromptWithTutor,
  type ExecutionPlan,
  type AttachedFile,
  type ExecuteTaskResponse,
  type PromptAnalysisResult,
} from '../utils/prismApi';
import { api } from '../utils/api';
import { FiCheckCircle, FiPlus, FiSend, FiMessageSquare, FiDollarSign, FiLink } from 'react-icons/fi';
import ExecutionSummaryModal from './ExecutionSummaryModal';
import ExecutionProgress from './ExecutionProgress';
import TokenAnalysisModal from './TokenAnalysisModal';
import TokenSavingsDashboard from './TokenSavingsDashboard';
import PromptTutorModal from './PromptTutorModal';

export interface PrismConsoleProps {
  activeTab: 'terminal' | 'history' | 'chats';
  setActiveTab: (tab: 'terminal' | 'history' | 'chats') => void;
  onTaskComplete?: () => void;
  selectedHistoryTask?: any;
}

export const PrismConsole: React.FC<PrismConsoleProps> = ({
  activeTab,
  setActiveTab,
  onTaskComplete,
  selectedHistoryTask,
}) => {
  const { activeAddress, signTransactions } = useWallet();

  // Input state
  const [taskDescription, setTaskDescription] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Pipeline state
  const [isPlanning, setIsPlanning] = useState(false);
  const [promptAnalysis, setPromptAnalysis] = useState<PromptAnalysisResult | null>(null);
  const [showPromptTutorModal, setShowPromptTutorModal] = useState(false);
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

  // Result / error state
  const [taskResult, setTaskResult] = useState<ExecuteTaskResponse | null>(null);
  const [error, setError] = useState<string>('');

  // History & Analysis state
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedAnalysisTask, setSelectedAnalysisTask] = useState<any | null>(null);

  // Chat Thread State
  const [chatHistory, setChatHistory] = useState<
    Array<{
      id: string;
      prompt: string;
      files?: AttachedFile[];
      result?: ExecuteTaskResponse;
      reply?: string;
      isChatReply?: boolean;
      error?: string;
      timestamp: Date;
    }>
  >([]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatScrollBottomRef = useRef<HTMLDivElement>(null);

  // Chat Tab state
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021';

  // Load history item into terminal when selected from outside
  useEffect(() => {
    if (!selectedHistoryTask) return;

    if (selectedHistoryTask._type === 'conversation') {
      const rawThread: any[] = selectedHistoryTask.thread || [];
      const hydratedThread = rawThread.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
      setChatHistory(hydratedThread);
      setConversationId(selectedHistoryTask._id);
      return;
    }

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
    setConversationId(null);
  }, [selectedHistoryTask]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      chatScrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, loading, isPlanning, error]);

  const saveThread = async (updatedHistory: typeof chatHistory, firstPrompt?: string) => {
    try {
      const serialized = updatedHistory.map((item) => ({
        ...item,
        files: item.files?.map((f) => ({ filename: f.filename })),
        timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp,
      }));

      let convoId = conversationId;

      if (!convoId) {
        const title = (firstPrompt || updatedHistory[0]?.prompt || 'New Chat').slice(0, 80);
        const { data } = await api.post('/api/chat/conversations', { title, thread: serialized });
        convoId = data._id;
        setConversationId(convoId);
      } else {
        await api.put(`/api/chat/conversations/${convoId}/thread`, { thread: serialized });
      }
    } catch (err) {
      console.warn('Thread save failed (non-fatal):', err);
    }
  };

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

  useEffect(() => {
    if (activeAddress && error === 'Please connect your wallet first in the top right.') {
      setError('');
    }
  }, [activeAddress, error]);

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

  const firstName = (() => {
    const saved = localStorage.getItem('prism_logged_in_user');
    if (!saved) return 'there';
    return saved.split(' ')[0];
  })();

  const runPlanTask = async (promptToUse: string, filesToUse: AttachedFile[]) => {
    setIsPlanning(true);
    setError('');
    setTaskResult(null);

    try {
      const hasPriorTaskResult = chatHistory.some((item) => item.result !== undefined && !item.isChatReply);
      const plan = await planTask(apiBaseUrl, promptToUse, filesToUse, hasPriorTaskResult);

      if (plan.category === 'conversational' || plan.isChat) {
        const newItem = {
          id: `msg-chat-${Date.now()}`,
          prompt: promptToUse,
          files: filesToUse,
          reply: plan.reply || plan.message || "Hello! I'm Prism.",
          isChatReply: true as const,
          timestamp: new Date(),
        };
        setChatHistory((prev) => {
          const updated = [...prev, newItem];
          saveThread(updated, promptToUse);
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
        prompt: promptToUse,
        files: filesToUse,
        error: msg,
        timestamp: new Date(),
      };
      setChatHistory((prev) => {
        const updated = [...prev, errItem];
        saveThread(updated, promptToUse);
        return updated;
      });
      setTaskDescription('');
      setAttachedFiles([]);
    } finally {
      setIsPlanning(false);
      isProcessingRef.current = false;
    }
  };

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
      // Step 1: Prompt Tutor optimization layer BEFORE plan-task
      const analysis = await analyzePromptWithTutor(apiBaseUrl, taskDescription, attachedFiles);
      setPromptAnalysis(analysis);
      setShowPromptTutorModal(true);
      setIsPlanning(false);
    } catch (err) {
      console.warn('Prompt Tutor analysis error (falling back to direct execution):', err);
      await runPlanTask(taskDescription, attachedFiles);
    }
  };

  const handleUseImprovedPrompt = async (improvedPrompt: string) => {
    setShowPromptTutorModal(false);
    setTaskDescription(improvedPrompt);
    await runPlanTask(improvedPrompt, attachedFiles);
  };

  const handleKeepOriginalPrompt = async () => {
    setShowPromptTutorModal(false);
    await runPlanTask(taskDescription, attachedFiles);
  };

  const handleCancelPromptTutor = () => {
    setShowPromptTutorModal(false);
    setPromptAnalysis(null);
    setIsPlanning(false);
    isProcessingRef.current = false;
  };

  const handleConfirmAndPay = async (filteredFiles: AttachedFile[], updatedPlan: ExecutionPlan) => {
    if (!executionPlan || !activeAddress || !signTransactions) return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    setShowSummaryModal(false);
    setLoading(true);
    setError('');

    const total = updatedPlan.executionQuantity;
    const category = updatedPlan.category;

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

      setExecProgress({ current: total, total, category, phase: 'verifying' });
      await new Promise((r) => setTimeout(r, 700));

      setExecProgress({ current: total, total, category, phase: 'completed' });
      await new Promise((r) => setTimeout(r, 500));

      setPaymentStatus('');
      setTaskResult(data);
      setExecProgress(null);

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
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleCancelSummary = () => {
    setShowSummaryModal(false);
    setExecutionPlan(null);
  };

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
      const files = (result.files ?? (result.file_path ? [result] : [])).filter((f: any) => f && typeof f.file_path === 'string' && f.file_path.trim() !== '');
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

  return (
    <div className="w-full flex flex-col items-center">
      {showPromptTutorModal && promptAnalysis && (
        <PromptTutorModal
          analysis={promptAnalysis}
          originalPrompt={taskDescription}
          onUseImproved={handleUseImprovedPrompt}
          onKeepOriginal={handleKeepOriginalPrompt}
          onClose={handleCancelPromptTutor}
        />
      )}

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

      {selectedAnalysisTask && (
        <TokenAnalysisModal
          task={selectedAnalysisTask}
          onClose={() => setSelectedAnalysisTask(null)}
        />
      )}

      {/* TERMINAL TAB */}
      {activeTab === 'terminal' && (
        <div
          className={`w-full flex flex-col items-center relative ${
            chatHistory.length > 0 ? 'justify-between min-h-screen pt-24 pb-36' : 'justify-center min-h-[calc(100vh-80px)]'
          }`}
        >
          {chatHistory.length === 0 && !loading && !isPlanning && (
            <div className="w-full max-w-4xl animate-fade-in flex flex-col items-center justify-center gap-8 my-auto">
              <div className="text-center">
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">Hi {firstName}, I'm Prism.</h1>
                <p className="text-xl text-indigo-300 font-medium">What do you need done?</p>
              </div>

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
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 w-full">
                  <button
                    type="button"
                    className="btn btn-circle btn-ghost text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 transition-colors shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || isPlanning}
                  >
                    +
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                  />

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

                  <button
                    className={`btn btn-circle shrink-0 ${
                      !taskDescription.trim() || loading || isPlanning
                        ? 'btn-ghost text-slate-700'
                        : 'btn-primary text-white scale-105 shadow-md shadow-indigo-500/20'
                    } transition-all duration-200`}
                    onClick={handleSubmitTask}
                    disabled={!taskDescription.trim() || loading || isPlanning}
                  >
                    <FiSend />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-3xl">
                {[
                  { label: '📄 Screen Resumes', text: 'Screen these candidate resumes for a Senior Backend Developer role' },
                  { label: '📜 Analyze Contract', text: 'Review this NDA contract and flag any high risk termination clauses' },
                  { label: '🧾 Extract Invoice Data', text: 'Extract vendor name, line items, and total amount from this invoice' },
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
            <div className="w-full max-w-4xl flex flex-col gap-6">
              {chatHistory.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 w-full animate-fade-in">
                  <div className="flex justify-end w-full">
                    <div className="bg-indigo-600/90 text-white rounded-2xl rounded-tr-sm px-5 py-3 text-sm max-w-[80%] shadow-lg border border-indigo-400/30 flex flex-col gap-1.5">
                      <p className="whitespace-pre-wrap leading-relaxed">{item.prompt}</p>
                      {item.files && item.files.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-indigo-400/20">
                          {item.files.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              className="text-[10px] bg-indigo-950/60 text-indigo-200 px-2 py-0.5 rounded-full font-mono border border-indigo-400/20"
                            >
                              📎 {f.filename}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

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

                        {/* Compact Prism Optimization Card */}
                        {item.result.tokenAnalytics && (
                          <div className="px-4 py-3 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950/60 border border-indigo-500/25 rounded-2xl flex flex-col gap-2 shadow-lg">
                            <div className="flex items-center justify-between border-b border-indigo-500/15 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                <span className="text-xs font-black text-white tracking-wide">Prism Optimization</span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                {item.result.tokenAnalytics.measurementSource === 'provider_usage' ? 'Provider Usage' : 'Estimated Usage'}
                              </span>
                            </div>

                            {item.result.tokenAnalytics.tokensSaved > 0 ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center py-1">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-medium">Input Tokens</span>
                                  <span className="text-xs font-bold text-slate-200">
                                    {item.result.tokenAnalytics.originalInputTokens.toLocaleString()} → {item.result.tokenAnalytics.optimizedInputTokens.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-medium">Tokens Saved</span>
                                  <span className="text-xs font-extrabold text-emerald-400">
                                    {item.result.tokenAnalytics.tokensSaved.toLocaleString()} ({(item.result.tokenAnalytics.compressionRatio || 0).toFixed(1)}%)
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-medium">Estimated AI Cost</span>
                                  <span className="text-xs font-bold text-slate-200">
                                    ${(item.result.tokenAnalytics.estimatedOriginalCost || 0).toFixed(3)} → ${(item.result.tokenAnalytics.optimizedCost || 0).toFixed(3)}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-medium">You Saved</span>
                                  <span className="text-xs font-extrabold text-emerald-300">
                                    ${(item.result.tokenAnalytics.costSaved || 0).toFixed(3)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 py-1 text-xs text-slate-300">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-indigo-200">Optimization baseline established</span>
                                  <span className="font-mono text-slate-400">
                                    {item.result.tokenAnalytics.originalInputTokens.toLocaleString()} input tokens measured
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Optimization savings will appear as Prism optimization features are enabled.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="w-full bg-slate-950/40 rounded-xl border border-slate-800/60 p-3.5 mt-1">
                          {renderFormattedResult(item.result.result, item.result.category)}
                        </div>
                      </div>
                    </div>
                  )}

                  {(item.reply || item.isChatReply) && (
                    <div className="flex justify-start w-full">
                      <div className="bg-slate-900/90 text-slate-100 rounded-2xl rounded-tl-sm px-5 py-3 text-sm max-w-[80%] shadow-lg border border-slate-800/80 flex items-start gap-3">
                        <img src="/icon.png" alt="Prism" className="w-6 h-6 rounded-full object-contain shrink-0 mt-0.5" />
                        <p className="whitespace-pre-wrap leading-relaxed flex-1">{item.reply}</p>
                      </div>
                    </div>
                  )}

                  {item.error && (
                    <div className="flex justify-start w-full">
                      <div
                        className={`p-4 rounded-2xl border text-xs max-w-[85%] leading-relaxed flex items-center gap-3 ${
                          item.error.includes("I'm not sure what you'd like done")
                            ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                        }`}
                      >
                        <span className="text-base">
                          {item.error.includes("I'm not sure what you'd like done") ? '💡' : '⚠️'}
                        </span>
                        <div className="flex-1">{item.error}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatScrollBottomRef} />
            </div>
          )}

          {isPlanning && (
            <div className="text-center my-4 flex flex-col items-center justify-center animate-fade-in">
              <div className="loading loading-spinner loading-lg text-indigo-400 mb-3" />
              <h2 className="text-xl font-bold text-indigo-300 animate-pulse">Analysing task &amp; discovering providers…</h2>
              <p className="text-xs text-slate-500 mt-1">Computing optimal routing and pricing</p>
            </div>
          )}

          {loading && execProgress && (
            <ExecutionProgress
              current={execProgress.current}
              total={execProgress.total}
              category={execProgress.category}
              phase={execProgress.phase}
              currentFilename={execProgress.currentFilename}
            />
          )}

          {loading && !execProgress && (
            <div className="text-center my-4 flex flex-col items-center justify-center">
              <div className="loading loading-spinner loading-lg text-primary mb-3" />
              <h2 className="text-2xl font-bold text-indigo-700 animate-pulse">Prism is working…</h2>
              {paymentStatus && <span className="text-sm text-slate-500 mt-1">{paymentStatus}</span>}
            </div>
          )}

          {error && (
            <div
              className={`w-full max-w-2xl mb-4 p-4 rounded-2xl border text-sm flex items-center gap-3 animate-fade-in ${
                error.includes("I'm not sure what you'd like done")
                  ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}
            >
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
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  className="btn btn-circle btn-ghost text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 transition-colors shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || isPlanning}
                >
                  +
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                />

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

                <button
                  className={`btn btn-circle shrink-0 ${
                    !taskDescription.trim() || loading || isPlanning
                      ? 'btn-ghost text-slate-700'
                      : 'btn-primary text-white scale-105 shadow-md shadow-indigo-500/20'
                  } transition-all duration-200`}
                  onClick={handleSubmitTask}
                  disabled={!taskDescription.trim() || loading || isPlanning}
                >
                  <FiSend />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="w-full flex flex-col gap-6">
          {/* Global Token Savings Dashboard */}
          <TokenSavingsDashboard />

          <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Task History</h2>
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
                    <th>Tokens</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task._id}>
                      <td className="max-w-[200px] truncate" title={task.prompt}>
                        {task.prompt}
                      </td>
                      <td>
                        <span className="admin-badge admin-badge--indigo">{task.category}</span>
                      </td>
                      <td className="font-mono text-[10px]">{task.providerName || task.selectedEndpoint || 'N/A'}</td>
                      <td>
                        <span className="font-mono text-xs text-indigo-300">
                          {task.plannerOutput?.originalInputTokens
                            ? `${task.plannerOutput.originalInputTokens.toLocaleString()} tokens`
                            : '~1,200 tokens'}
                        </span>
                      </td>
                      <td className="font-bold text-emerald-400">${(task.totalCost ?? 0).toFixed(2)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            task.refundIssued || task.verificationStatus === 'failed'
                              ? 'admin-badge--rose'
                              : task.status === 'completed'
                              ? 'admin-badge--green'
                              : 'admin-badge--slate'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="flex items-center gap-1.5">
                        <button
                          className="btn btn-xs btn-outline btn-primary rounded-lg text-[10px]"
                          onClick={() => {
                            setTaskResult(task.output ? { ...task, result: task.output } : task);
                            setActiveTab('terminal');
                          }}
                        >
                          Output
                        </button>
                        <button
                          className="btn btn-xs btn-outline btn-accent rounded-lg text-[10px]"
                          onClick={() => setSelectedAnalysisTask(task)}
                        >
                          Token Analysis
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

      {/* CHATS TAB */}
      {activeTab === 'chats' && (
        <div className="w-full flex gap-6 h-[500px]">
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
              {conversations.length === 0 && <p className="text-slate-500 text-center text-xs py-10">No chats started.</p>}
            </div>
          </div>

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
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isUser
                              ? 'bg-indigo-500 text-white rounded-br-none'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                          }`}
                        >
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
    </div>
  );
};
export default PrismConsole;
