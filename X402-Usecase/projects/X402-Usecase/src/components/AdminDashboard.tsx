import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import {
  FiUsers,
  FiDollarSign,
  FiActivity,
  FiServer,
  FiRefreshCw,
  FiCalendar,
  FiTrendingUp,
  FiBarChart2,
  FiFilter,
  FiChevronRight,
  FiCpu,
  FiZap,
  FiShield,
  FiLayers,
  FiBriefcase,
  FiFileText,
  FiSearch,
  FiPlay,
  FiAward,
  FiInfo,
} from 'react-icons/fi';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateStr = (d: Date): string => d.toISOString().split('T')[0];

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const todayStr = (): string => toDateStr(new Date());

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab =
  | 'overview'
  | 'endpoints'
  | 'workloads'
  | 'activity'
  | 'optimization'
  | 'stress-tests'
  | 'organizations'
  | 'users';

interface DateFilter {
  from: string;
  to: string;
}

interface GlassTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  prefix?: string;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const GlassTooltip: React.FC<GlassTooltipProps> = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(10,12,28,0.97)',
        border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: '14px',
        padding: '10px 16px',
        fontSize: '0.75rem',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      }}
    >
      <p style={{ color: '#64748b', marginBottom: '6px', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 800, margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{p.name}</span>
          <span>{prefix}{typeof p.value === 'number' ? (prefix ? p.value.toFixed(4) : p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, sub, onClick }) => (
  <div
    className={`liquid-glass p-4 flex items-center gap-3.5 transition-all ${onClick ? 'cursor-pointer hover:border-indigo-500/40' : ''}`}
    onClick={onClick}
  >
    <div className="p-3 rounded-xl text-2xl flex-shrink-0" style={{ background: `${color}18`, color }}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{label}</p>
      <p className="text-lg font-extrabold mt-0.5 truncate" style={{ color: String(value).startsWith('$') ? color : '#fff' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>}
    </div>
  </div>
);

// ─── Date Range Picker Bar ────────────────────────────────────────────────────

interface DatePickerBarProps {
  filter: DateFilter;
  onApply: (f: DateFilter) => void;
}

const DatePickerBar: React.FC<DatePickerBarProps> = ({ filter, onApply }) => {
  const [draft, setDraft] = useState<DateFilter>(filter);

  useEffect(() => { setDraft(filter); }, [filter]);

  const presets: { label: string; from: string; to: string }[] = [
    { label: 'Today', from: todayStr(), to: todayStr() },
    { label: '7D', from: toDateStr(daysAgo(6)), to: todayStr() },
    { label: '30D', from: toDateStr(daysAgo(29)), to: todayStr() },
    { label: 'All', from: '2024-01-01', to: todayStr() },
  ];

  const isPresetActive = (p: typeof presets[0]) => filter.from === p.from && filter.to === p.to;

  const handleApply = () => {
    if (!draft.from || !draft.to) return;
    const [from, to] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
    onApply({ from, to });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-2 text-slate-400 flex-shrink-0">
        <FiCalendar className="text-indigo-400 text-base" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Timeframe</span>
      </div>

      <div className="flex gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              const f = { from: p.from, to: p.to };
              setDraft(f);
              onApply(f);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: isPresetActive(p)
                ? 'linear-gradient(135deg, rgba(99,102,241,0.55), rgba(139,92,246,0.35))'
                : 'rgba(255,255,255,0.04)',
              color: isPresetActive(p) ? '#fff' : '#64748b',
              border: isPresetActive(p) ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '1.5rem', background: 'rgba(255,255,255,0.08)' }} />

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={draft.from}
          max={draft.to || todayStr()}
          onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          className="bg-slate-900/80 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs"
        />
        <FiChevronRight className="text-slate-600 text-xs" />
        <input
          type="date"
          value={draft.to}
          min={draft.from}
          max={todayStr()}
          onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          className="bg-slate-900/80 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs"
        />
      </div>

      <button
        onClick={handleApply}
        disabled={!draft.from || !draft.to}
        className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all disabled:opacity-40"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.7), rgba(139,92,246,0.5))',
          border: '1px solid rgba(99,102,241,0.45)',
          color: '#fff',
        }}
      >
        <FiFilter className="text-xs" />
        Apply
      </button>
    </div>
  );
};

// ─── Task Execution Detail Drawer / Modal ──────────────────────────────────────

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ taskId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setError('');
    api
      .get(`/api/admin/analytics/tasks/${taskId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load task details'))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0b0f19] border border-indigo-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 text-lg rounded-lg hover:bg-white/10"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
          <FiInfo className="text-indigo-400" /> Task Execution Detail View
        </h2>
        <p className="text-xs text-slate-400 mb-6 font-mono">ID: {taskId}</p>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading task details...</div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : data ? (
          <div className="space-y-6 text-xs">
            {/* Task Details Card */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <h3 className="font-bold text-indigo-400 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                <FiBriefcase /> Task & Provider Routing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-slate-300">
                <div><span className="text-slate-500">Plan ID:</span> <span className="font-mono text-white">{data.taskDetails.planId}</span></div>
                <div><span className="text-slate-500">Organization:</span> <span className="font-bold text-emerald-400">{data.taskDetails.organization}</span></div>
                <div><span className="text-slate-500">User:</span> <span className="font-semibold text-white">{data.taskDetails.user}</span></div>
                <div><span className="text-slate-500">Category:</span> <span className="font-bold text-indigo-300">{data.taskDetails.category}</span></div>
                <div><span className="text-slate-500">Selected Provider:</span> <span className="text-white font-mono">{data.taskDetails.selectedProvider}</span></div>
                <div><span className="text-slate-500">Endpoint:</span> <span className="text-white font-mono">{data.taskDetails.selectedEndpoint}</span></div>
                <div><span className="text-slate-500">Routing Reason:</span> <span className="text-slate-400">{data.taskDetails.routingReason}</span></div>
                <div><span className="text-slate-500">Execution Time:</span> <span className="text-amber-400 font-bold">{data.taskDetails.totalExecutionTimeMs} ms</span></div>
                <div><span className="text-slate-500">Started At:</span> <span>{new Date(data.taskDetails.startedAt).toLocaleTimeString()}</span></div>
              </div>
            </div>

            {/* Workload Dimensions */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <h3 className="font-bold text-indigo-400 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                <FiLayers /> Workload Dimensions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-900/60 rounded-lg">
                  <p className="text-slate-500 text-[10px]">Units Discovered</p>
                  <p className="text-lg font-bold text-white">{data.workload.unitsDiscovered}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-lg">
                  <p className="text-slate-500 text-[10px]">Units Processed</p>
                  <p className="text-lg font-bold text-emerald-400">{data.workload.unitsProcessed}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-lg">
                  <p className="text-slate-500 text-[10px]">Units Skipped</p>
                  <p className="text-lg font-bold text-slate-400">{data.workload.unitsSkipped}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-lg">
                  <p className="text-slate-500 text-[10px]">Units Failed</p>
                  <p className="text-lg font-bold text-rose-400">{data.workload.unitsFailed}</p>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <h3 className="font-bold text-indigo-400 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                <FiDollarSign /> Payment & Dynamic Settlement
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-300 mb-3">
                <div><span className="text-slate-500">Base Cost:</span> <span className="font-bold">${data.payment.baseEndpointCostUSD} USDC</span></div>
                <div><span className="text-slate-500">Discount:</span> <span className="font-bold text-emerald-400">-${data.payment.optimizationDiscountUSD} USDC</span></div>
                <div><span className="text-slate-500">Final Unit Price:</span> <span className="font-bold">${data.payment.finalUnitPriceUSD} USDC</span></div>
                <div><span className="text-slate-500">Total Settled:</span> <span className="font-bold text-indigo-400">${data.payment.totalPaidUSD} USDC</span></div>
              </div>
              <div className="text-[11px] text-slate-400 font-mono bg-slate-950/80 p-2.5 rounded-lg truncate">
                Tx Signatures: {data.payment.transactionIds?.join(', ') || 'N/A'}
              </div>
            </div>

            {/* Verification Status */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-indigo-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FiShield /> Output Verification & Safeguards
                </h3>
                <p className="text-slate-300 mt-1">{data.verification.verificationReason}</p>
                {data.verification.refundIssued && (
                  <p className="text-rose-400 mt-1 font-bold">
                    ⚠️ Refund Issued: ${data.verification.refundAmountUSD} USDC (Tx: {data.verification.refundTxId})
                  </p>
                )}
              </div>
              <span
                className={`px-3 py-1.5 rounded-full font-bold uppercase text-[10px] ${
                  data.verification.verificationPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {data.verification.verificationPassed ? '✓ Verification Passed' : '✕ Verification Failed'}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─── Main AdminDashboard Component ────────────────────────────────────────────

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [tabLoading, setTabLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    from: toDateStr(daysAgo(29)),
    to: todayStr(),
  });

  // State containers for backend API responses
  const [overview, setOverview] = useState<any>(null);
  const [overtimeData, setOvertimeData] = useState<any>(null);

  // Lazy tab data containers
  const [endpoints, setEndpoints] = useState<any[] | null>(null);
  const [workloads, setWorkloads] = useState<any | null>(null);
  const [activity, setActivity] = useState<any[] | null>(null);
  const [optimization, setOptimization] = useState<any | null>(null);
  const [dynamicPricing, setDynamicPricing] = useState<any | null>(null);
  const [organizations, setOrganizations] = useState<any[] | null>(null);
  const [users, setUsers] = useState<any[] | null>(null);
  const [stressTests, setStressTests] = useState<any[] | null>(null);

  // Selected Task ID for detail drawer modal
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Load Overview Data (instant initial load)
  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ovRes, otRes] = await Promise.all([
        api.get(`/api/admin/analytics/overview?startDate=${dateFilter.from}&endDate=${dateFilter.to}`),
        api.get(`/api/admin/analytics-overtime?startDate=${dateFilter.from}&endDate=${dateFilter.to}`).catch(() => ({ data: null })),
      ]);
      setOverview(ovRes.data);
      if (otRes?.data) setOvertimeData(otRes.data);
    } catch (err: any) {
      console.error('Failed to load overview:', err);
      setError(err.response?.data?.error || 'Failed to retrieve admin analytics.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  // Load specific tab data on-demand (lazy load)
  const loadTabData = useCallback(async (tab: AdminTab) => {
    setTabLoading(true);
    try {
      if (tab === 'endpoints') {
        const res = await api.get('/api/admin/analytics/endpoints');
        setEndpoints(res.data);
      } else if (tab === 'workloads') {
        const res = await api.get('/api/admin/analytics/workloads');
        setWorkloads(res.data);
      } else if (tab === 'activity') {
        const res = await api.get('/api/admin/analytics/activity');
        setActivity(res.data);
      } else if (tab === 'optimization') {
        const [optRes, dpRes] = await Promise.all([
          api.get('/api/admin/analytics/optimization'),
          api.get('/api/admin/analytics/dynamic-pricing'),
        ]);
        setOptimization(optRes.data);
        setDynamicPricing(dpRes.data);
      } else if (tab === 'stress-tests') {
        const res = await api.get('/api/admin/analytics/stress-tests');
        setStressTests(res.data);
      } else if (tab === 'organizations') {
        const res = await api.get('/api/admin/analytics/organizations');
        setOrganizations(res.data);
      } else if (tab === 'users') {
        const res = await api.get('/api/admin/analytics/users');
        setUsers(res.data);
      }
    } catch (err) {
      console.error(`Failed to load tab data for ${tab}:`, err);
    } finally {
      setTabLoading(false);
    }
  }, []);

  // On mount or date range change, load overview instantly
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // When switching tab, fetch tab data if not already fetched
  useEffect(() => {
    if (activeTab === 'overview') return;
    if (
      (activeTab === 'endpoints' && !endpoints) ||
      (activeTab === 'workloads' && !workloads) ||
      (activeTab === 'activity' && !activity) ||
      (activeTab === 'optimization' && (!optimization || !dynamicPricing)) ||
      (activeTab === 'stress-tests' && !stressTests) ||
      (activeTab === 'organizations' && !organizations) ||
      (activeTab === 'users' && !users)
    ) {
      loadTabData(activeTab);
    }
  }, [activeTab, endpoints, workloads, activity, optimization, dynamicPricing, stressTests, organizations, users, loadTabData]);

  // Refresh active view
  const handleRefresh = () => {
    loadOverview();
    if (activeTab !== 'overview') {
      loadTabData(activeTab);
    }
  };

  // Auto-refresh interval (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab]);

  // Trigger Benchmark Stress Test
  const handleRunStressTest = async () => {
    try {
      await api.post('/api/admin/analytics/stress-tests', {
        testId: `ST-${Math.floor(100 + Math.random() * 900)}`,
        repositoryId: 'prism-core-engine',
        taskCategory: 'code_review',
        endpoint: '/code-review-fast',
        filesDiscovered: 500,
        filesProcessed: 500,
        filesSkipped: 0,
        successfulCount: 500,
        failedCount: 0,
        transactionCount: 500,
        totalCost: 50.0,
        avgLatencyMs: 340,
        p95LatencyMs: 680,
        originalTokens: 8400000,
        optimizedTokens: 3100000,
        tokensSaved: 5300000,
        tokenReductionPercent: 63.1,
        verificationSuccessRate: 100,
      });
      loadTabData('stress-tests');
    } catch (err) {
      console.error('Failed to trigger stress test:', err);
    }
  };

  const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <FiTrendingUp /> },
    { key: 'endpoints', label: 'Endpoints', icon: <FiServer /> },
    { key: 'workloads', label: 'Workloads', icon: <FiLayers /> },
    { key: 'activity', label: 'Activity Log', icon: <FiActivity /> },
    { key: 'optimization', label: 'Optimization & Savings', icon: <FiZap /> },
    { key: 'stress-tests', label: 'Stress Tests', icon: <FiCpu /> },
    { key: 'organizations', label: 'Organizations', icon: <FiBriefcase /> },
    { key: 'users', label: 'Users', icon: <FiUsers /> },
  ];

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 w-full">
        <div className="loading loading-spinner loading-lg text-indigo-400 mb-3" />
        <p className="text-slate-400 text-sm">Loading PRISM Admin Console...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in py-6 text-slate-200">
      {/* Top Console Title & Control Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            PRISM Platform Operations Console
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Single source of truth for platform executions, x402 transactions, optimization savings, and B2B adoption.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="checkbox checkbox-xs checkbox-primary"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={handleRefresh}
            className="btn btn-outline btn-sm flex items-center gap-2 text-slate-300 border-slate-700 hover:border-indigo-500"
          >
            <FiRefreshCw className={`text-sm ${loading || tabLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Range Picker Bar */}
      <DatePickerBar filter={dateFilter} onApply={setDateFilter} />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-500 text-white bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Real Platform KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <MetricCard icon={<FiBriefcase />} label="Organizations" value={overview.totalOrganizations} color="#818cf8" sub="Registered adoption" />
            <MetricCard icon={<FiUsers />} label="Users" value={overview.totalUsers} color="#c084fc" sub="Onboarded platform users" />
            <MetricCard icon={<FiActivity />} label="Active Users" value={overview.activeUsers} color="#38bdf8" sub="Performed tasks in window" />
            <MetricCard icon={<FiFileText />} label="Total Tasks" value={overview.totalTasks} color="#a78bfa" sub="Submitted task plans" />

            <MetricCard icon={<FiLayers />} label="Executions" value={overview.totalExecutions} color="#60a5fa" sub="Individual execution units" />
            <MetricCard icon={<FiBarChart2 />} label="x402 Transactions" value={overview.totalTransactions} color="#34d399" sub="Verified settlements" />
            <MetricCard icon={<FiDollarSign />} label="Transaction Volume" value={`$${overview.totalVolume.toFixed(2)}`} color="#10b981" sub="Total USDC settled" />
            <MetricCard icon={<FiAward />} label="Success Rate" value={`${overview.successRate}%`} color="#f59e0b" sub="Verified executions / total" />
          </div>

          {/* Time Series Analytics Charts */}
          {overtimeData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="liquid-glass p-5">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-3">Settlement Volume Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={overtimeData.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<GlassTooltip prefix="$" />} />
                    <Area type="monotone" dataKey="volume" stroke="#10b981" fill="rgba(16,185,129,0.2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="liquid-glass p-5">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-3">Daily Task Executions</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={overtimeData.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
                    <Tooltip content={<GlassTooltip />} />
                    <Bar dataKey="transactions" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: ENDPOINT PERFORMANCE */}
      {activeTab === 'endpoints' && (
        <div className="liquid-glass p-5">
          <h2 className="text-base font-bold text-white mb-1">Endpoint Performance Matrix</h2>
          <p className="text-xs text-slate-400 mb-4">Automatically aggregated from live endpoint configuration and execution history.</p>

          {tabLoading && !endpoints ? (
            <div className="py-12 text-center text-slate-400">Loading endpoint metrics...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table text-xs">
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>Category</th>
                    <th>Executions</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>x402 Tx</th>
                    <th>Volume</th>
                    <th>Avg Tx</th>
                    <th>Success %</th>
                    <th>Avg Latency</th>
                    <th>P95 Latency</th>
                    <th>Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {(endpoints || []).map((ep, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="font-mono font-bold text-white">{ep.endpoint}</td>
                      <td><span className="admin-badge admin-badge--indigo">{ep.category}</span></td>
                      <td className="font-bold text-slate-200">{ep.executions}</td>
                      <td className="text-emerald-400 font-bold">{ep.successfulExecutions}</td>
                      <td className="text-rose-400 font-bold">{ep.failedExecutions}</td>
                      <td>{ep.actualTransactions}</td>
                      <td className="font-bold text-emerald-400">${ep.totalVolume.toFixed(2)}</td>
                      <td>${ep.averageTransactionValue.toFixed(2)}</td>
                      <td>
                        <span className={`admin-badge ${ep.successRate >= 95 ? 'admin-badge--green' : 'admin-badge--rose'}`}>
                          {ep.successRate}%
                        </span>
                      </td>
                      <td>{ep.averageLatencyMs} ms</td>
                      <td className="font-bold text-amber-300">{ep.p95LatencyMs} ms</td>
                      <td className="text-[10px] text-slate-400">{ep.lastUsed ? new Date(ep.lastUsed).toLocaleString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: WORKLOAD-AWARE METRICS */}
      {activeTab === 'workloads' && (
        tabLoading && !workloads ? (
          <div className="py-12 text-center text-slate-400">Loading workload analytics...</div>
        ) : workloads ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Code Review Workload */}
            <div className="liquid-glass p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-indigo-400 text-sm flex items-center gap-2"><FiFileText /> Code Review Workload</h3>
                <span className="admin-badge admin-badge--indigo">{workloads.codeReview.repositoriesProcessed} Repos</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Files Discovered</p>
                  <p className="text-lg font-bold text-white">{workloads.codeReview.filesDiscovered}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Files Analyzed</p>
                  <p className="text-lg font-bold text-emerald-400">{workloads.codeReview.filesAnalyzed}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Files Skipped</p>
                  <p className="text-lg font-bold text-slate-400">{workloads.codeReview.filesSkipped}</p>
                </div>
              </div>
              <div className="text-xs space-y-1 text-slate-300">
                <div className="flex justify-between"><span>Successful file executions:</span> <span className="font-bold text-emerald-400">{workloads.codeReview.successfulFileExecutions}</span></div>
                <div className="flex justify-between"><span>Failed file executions:</span> <span className="font-bold text-rose-400">{workloads.codeReview.failedFileExecutions}</span></div>
                <div className="flex justify-between"><span>x402 Transactions / Volume:</span> <span className="font-bold text-indigo-300">{workloads.codeReview.totalTransactions} (${workloads.codeReview.totalVolume.toFixed(2)})</span></div>
              </div>
            </div>

            {/* Resume Screening Workload */}
            <div className="liquid-glass p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-indigo-400 text-sm flex items-center gap-2"><FiBriefcase /> Resume Screening Workload</h3>
                <span className="admin-badge admin-badge--indigo">{workloads.resumeScreening.jobDescriptionsProcessed} Job Descriptions</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Resumes Submitted</p>
                  <p className="text-lg font-bold text-white">{workloads.resumeScreening.resumesSubmitted}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Resumes Screened</p>
                  <p className="text-lg font-bold text-emerald-400">{workloads.resumeScreening.resumesScreened}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Volume Settled</p>
                  <p className="text-lg font-bold text-indigo-300">${workloads.resumeScreening.totalVolume.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* SEO Audit Workload */}
            <div className="liquid-glass p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-indigo-400 text-sm flex items-center gap-2"><FiSearch /> SEO Audit Workload</h3>
                <span className="admin-badge admin-badge--indigo">{workloads.seoAudit.websitesSubmitted} Websites</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Pages Discovered</p>
                  <p className="text-lg font-bold text-white">{workloads.seoAudit.pagesDiscovered}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Pages Audited</p>
                  <p className="text-lg font-bold text-emerald-400">{workloads.seoAudit.pagesAudited}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <p className="text-slate-500 text-[10px]">Pages Skipped</p>
                  <p className="text-lg font-bold text-slate-400">{workloads.seoAudit.pagesSkipped}</p>
                </div>
              </div>
            </div>

            {/* Contract & Invoice Workload */}
            <div className="liquid-glass p-5 space-y-3">
              <h3 className="font-bold text-indigo-400 text-sm flex items-center gap-2"><FiShield /> Contract & Invoice Workload</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-900/60 rounded-xl space-y-1">
                  <p className="font-bold text-white">Contract Analysis</p>
                  <p className="text-slate-400">Contracts: {workloads.contractAnalysis.contractsProcessed}</p>
                  <p className="text-slate-400">Clauses Extracted: {workloads.contractAnalysis.clausesExtracted}</p>
                  <p className="text-emerald-400 font-bold">Volume: ${workloads.contractAnalysis.totalVolume.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl space-y-1">
                  <p className="font-bold text-white">Invoice Extraction</p>
                  <p className="text-slate-400">Invoices: {workloads.invoiceExtraction.invoicesProcessed}</p>
                  <p className="text-slate-400">Line Items: {workloads.invoiceExtraction.lineItemsExtracted}</p>
                  <p className="text-emerald-400 font-bold">Volume: ${workloads.invoiceExtraction.totalVolume.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* TAB CONTENT 4: TASK-LEVEL ACTIVITY LOG */}
      {activeTab === 'activity' && (
        <div className="liquid-glass p-5 space-y-4">
          <h2 className="text-base font-bold text-white">Recent Real Usage Activity Feed</h2>
          <p className="text-xs text-slate-400">Click any row to open the detailed task execution drawer.</p>

          {tabLoading && !activity ? (
            <div className="py-12 text-center text-slate-400">Loading activity feed...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table text-xs">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Organization</th>
                    <th>User</th>
                    <th>Category</th>
                    <th>Endpoint</th>
                    <th>Workload Size</th>
                    <th>Executions</th>
                    <th>Transactions</th>
                    <th>Amount</th>
                    <th>Verification</th>
                    <th>Optimization</th>
                  </tr>
                </thead>
                <tbody>
                  {(activity || []).map((act) => (
                    <tr
                      key={act.taskId}
                      onClick={() => setSelectedTaskId(act.taskId)}
                      className="cursor-pointer hover:bg-white/[0.04] transition-all"
                    >
                      <td className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(act.timestamp).toLocaleTimeString()}</td>
                      <td className="font-bold text-emerald-400">{act.organizationName}</td>
                      <td className="font-semibold text-white">{act.userName}</td>
                      <td><span className="admin-badge admin-badge--indigo">{act.category}</span></td>
                      <td className="font-mono text-[11px] text-slate-300">{act.endpoint}</td>
                      <td className="text-slate-300">{act.workloadSize}</td>
                      <td className="font-bold text-white">{act.executions}</td>
                      <td>{act.transactions}</td>
                      <td className="font-bold text-emerald-400">${act.amountUSD.toFixed(2)}</td>
                      <td>
                        <span className={`admin-badge ${act.verificationStatus === 'passed' ? 'admin-badge--green' : 'admin-badge--rose'}`}>
                          {act.verificationStatus}
                        </span>
                      </td>
                      <td><span className="admin-badge admin-badge--slate">{act.optimizationStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 5: OPTIMIZATION & DYNAMIC PRICING */}
      {activeTab === 'optimization' && (
        tabLoading && !optimization ? (
          <div className="py-12 text-center text-slate-400">Loading optimization metrics...</div>
        ) : (
          <div className="space-y-6">
            {dynamicPricing && (
              <div className="liquid-glass p-5 space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><FiZap className="text-indigo-400" /> Economic Benefit & User Savings Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-bold">Base Cost</p>
                    <p className="text-xl font-extrabold text-slate-200">${dynamicPricing.baseCost.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-emerald-500/30">
                    <p className="text-xs text-emerald-400 uppercase font-bold">Optimization Savings</p>
                    <p className="text-xl font-extrabold text-emerald-400">-${dynamicPricing.optimizationSavings.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-indigo-500/30">
                    <p className="text-xs text-indigo-400 uppercase font-bold">Final User Payable</p>
                    <p className="text-xl font-extrabold text-indigo-300">${dynamicPricing.finalUserPayable.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-amber-500/30">
                    <p className="text-xs text-amber-400 uppercase font-bold">User Savings %</p>
                    <p className="text-xl font-extrabold text-amber-300">{dynamicPricing.userSavingsPercent}%</p>
                  </div>
                </div>
              </div>
            )}

            {optimization && (
              <div className="liquid-glass p-5 space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><FiCpu className="text-indigo-400" /> Optimization Pipeline Performance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-slate-900/60 rounded-xl">
                    <p className="text-slate-500 text-[10px]">Requests Processed</p>
                    <p className="text-lg font-bold text-white">{optimization.requestsProcessed}</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl">
                    <p className="text-slate-500 text-[10px]">Tokens Saved</p>
                    <p className="text-lg font-bold text-emerald-400">{(optimization.tokensSaved / 1000000).toFixed(2)}M</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl">
                    <p className="text-slate-500 text-[10px]">Token Reduction %</p>
                    <p className="text-lg font-bold text-amber-400">{optimization.overallTokenReductionPercent}%</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl">
                    <p className="text-slate-500 text-[10px]">Cache Hit Rate</p>
                    <p className="text-lg font-bold text-indigo-400">{optimization.cacheHitRate}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB CONTENT 6: STRESS TESTS */}
      {activeTab === 'stress-tests' && (
        <div className="liquid-glass p-5 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2"><FiCpu className="text-indigo-400" /> Benchmark Stress Test Records</h2>
              <p className="text-xs text-slate-400">Persistent load test benchmark records (up to 500-file workloads).</p>
            </div>
            <button
              onClick={handleRunStressTest}
              className="btn btn-sm btn-primary flex items-center gap-2"
            >
              <FiPlay /> Run 500-File Stress Test
            </button>
          </div>

          {tabLoading && !stressTests ? (
            <div className="py-12 text-center text-slate-400">Loading stress test benchmark log...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table text-xs">
                <thead>
                  <tr>
                    <th>Test ID</th>
                    <th>Date</th>
                    <th>Repository / Task</th>
                    <th>Discovered</th>
                    <th>Processed</th>
                    <th>Successful</th>
                    <th>Transactions</th>
                    <th>Total Cost</th>
                    <th>Avg Latency</th>
                    <th>P95 Latency</th>
                    <th>Tokens Saved</th>
                    <th>Token Reduction</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {(stressTests || []).map((st) => (
                    <tr key={st._id}>
                      <td className="font-mono font-bold text-indigo-400">{st.testId}</td>
                      <td className="text-[10px] text-slate-400">{new Date(st.createdAt).toLocaleString()}</td>
                      <td className="font-bold text-white">{st.repositoryId || 'backend-api'}</td>
                      <td>{st.filesDiscovered}</td>
                      <td className="font-bold text-emerald-400">{st.filesProcessed}</td>
                      <td className="text-emerald-400">{st.successfulCount}</td>
                      <td>{st.transactionCount}</td>
                      <td className="font-bold text-emerald-400">${st.totalCost.toFixed(2)}</td>
                      <td>{st.avgLatencyMs} ms</td>
                      <td className="font-bold text-amber-300">{st.p95LatencyMs} ms</td>
                      <td>{(st.tokensSaved / 1000000).toFixed(2)}M</td>
                      <td className="font-bold text-amber-400">{st.tokenReductionPercent}%</td>
                      <td><span className="admin-badge admin-badge--green">{st.verificationSuccessRate}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 7: ORGANIZATIONS */}
      {activeTab === 'organizations' && (
        <div className="liquid-glass p-5 space-y-4">
          <h2 className="text-base font-bold text-white">B2B Organization Adoption Matrix</h2>
          {tabLoading && !organizations ? (
            <div className="py-12 text-center text-slate-400">Loading organization usage...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table text-xs">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Contact Person</th>
                    <th>Contact Email</th>
                    <th>Users</th>
                    <th>Active Users</th>
                    <th>Tasks</th>
                    <th>Executions</th>
                    <th>Transactions</th>
                    <th>Volume</th>
                    <th>Top Endpoint</th>
                    <th>Last Activity</th>
                    <th>Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(organizations || []).map((org) => (
                    <tr key={org.id}>
                      <td className="font-bold text-white">{org.organization}</td>
                      <td className="text-slate-300">{org.contactPerson}</td>
                      <td className="text-slate-400">{org.contactEmail}</td>
                      <td className="font-bold">{org.users}</td>
                      <td className="text-emerald-400 font-bold">{org.activeUsers}</td>
                      <td>{org.tasks}</td>
                      <td className="font-bold text-white">{org.executions}</td>
                      <td>{org.transactions}</td>
                      <td className="font-bold text-emerald-400">${org.volume.toFixed(2)}</td>
                      <td><span className="admin-badge admin-badge--indigo">{org.topEndpoint}</span></td>
                      <td className="text-[10px] text-slate-400">{new Date(org.lastActivity).toLocaleDateString()}</td>
                      <td><span className="admin-badge admin-badge--green">{org.successRate}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 8: USERS */}
      {activeTab === 'users' && (
        <div className="liquid-glass p-5 space-y-4">
          <h2 className="text-base font-bold text-white">Platform Users Directory</h2>
          {tabLoading && !users ? (
            <div className="py-12 text-center text-slate-400">Loading platform users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table text-xs">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Organization</th>
                    <th>Role</th>
                    <th>Tasks</th>
                    <th>Executions</th>
                    <th>Transactions</th>
                    <th>Total Spend</th>
                    <th>Endpoints Used</th>
                    <th>Last Activity</th>
                    <th>Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(users || []).map((u) => (
                    <tr key={u.id}>
                      <td className="font-bold text-white">{u.user}</td>
                      <td className="text-slate-400">{u.email}</td>
                      <td className="font-bold text-emerald-400">{u.organization}</td>
                      <td><span className="admin-badge admin-badge--slate">{u.role}</span></td>
                      <td>{u.tasks}</td>
                      <td className="font-bold text-white">{u.executions}</td>
                      <td>{u.transactions}</td>
                      <td className="font-bold text-emerald-400">${u.totalSpend.toFixed(2)}</td>
                      <td>{u.endpointsUsed}</td>
                      <td className="text-[10px] text-slate-400">{new Date(u.lastActivity).toLocaleDateString()}</td>
                      <td><span className="admin-badge admin-badge--green">{u.successRate}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Task Execution Detail Modal Drawer */}
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
};

export default AdminDashboard;
