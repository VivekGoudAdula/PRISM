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
  Legend,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a YYYY-MM-DD string for a given Date object */
const toDateStr = (d: Date): string => d.toISOString().split('T')[0];

/** Returns a Date N days ago (start of that day) */
const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Today as YYYY-MM-DD */
const todayStr = (): string => toDateStr(new Date());

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab = 'analytics' | 'users' | 'tasks' | 'payments' | 'endpoints';

interface DateFilter {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

interface OvertimeSeries {
  date: string;
  volume: number;
  settlements: number;
  transactions: number;
  newUsers: number;
}

interface OvertimeData {
  startDate: string;
  endDate: string;
  series: OvertimeSeries[];
  totals: {
    volume: number;
    settlements: number;
    transactions: number;
    newUsers: number;
  };
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

/** Recharts custom tooltip with glassmorphic styling */
const GlassTooltip: React.FC<any> = ({ active, payload, label, prefix = '' }) => {
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
      <p style={{ color: '#64748b', marginBottom: '6px', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 800, margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{p.name}</span>
          <span>{prefix}{typeof p.value === 'number' ? (prefix ? p.value.toFixed(4) : p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Date Range Picker Bar ────────────────────────────────────────────────────

interface DatePickerBarProps {
  filter: DateFilter;
  onApply: (f: DateFilter) => void;
}

/**
 * From / To date range picker with quick-preset shortcuts.
 * Shows a calendar icon, two date inputs, and an Apply button.
 * Preset buttons (7D, 30D, 90D, All) set the range and apply immediately.
 */
const DatePickerBar: React.FC<DatePickerBarProps> = ({ filter, onApply }) => {
  const [draft, setDraft] = useState<DateFilter>(filter);

  // Keep draft in sync if parent resets filter (e.g. on data refresh)
  useEffect(() => { setDraft(filter); }, [filter]);

  const presets: { label: string; from: string; to: string }[] = [
    { label: '7D',  from: toDateStr(daysAgo(6)),   to: todayStr() },
    { label: '30D', from: toDateStr(daysAgo(29)),  to: todayStr() },
    { label: '90D', from: toDateStr(daysAgo(89)),  to: todayStr() },
    { label: 'All', from: '2024-01-01',             to: todayStr() },
  ];

  /** Check if a preset is currently active */
  const isPresetActive = (p: typeof presets[0]) => filter.from === p.from && filter.to === p.to;

  const handleApply = () => {
    if (!draft.from || !draft.to) return;
    // Swap if from > to
    const [from, to] = draft.from <= draft.to
      ? [draft.from, draft.to]
      : [draft.to, draft.from];
    onApply({ from, to });
  };

  const handlePreset = (p: typeof presets[0]) => {
    const f = { from: p.from, to: p.to };
    setDraft(f);
    onApply(f);
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
      {/* Calendar icon + label */}
      <div className="flex items-center gap-2 text-slate-400 flex-shrink-0">
        <FiCalendar className="text-indigo-400 text-base" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Date Range</span>
      </div>

      {/* Preset Pills */}
      <div className="flex gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: isPresetActive(p)
                ? 'linear-gradient(135deg, rgba(99,102,241,0.55), rgba(139,92,246,0.35))'
                : 'rgba(255,255,255,0.04)',
              color: isPresetActive(p) ? '#fff' : '#64748b',
              border: isPresetActive(p) ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
              boxShadow: isPresetActive(p) ? '0 4px 12px rgba(99,102,241,0.2)' : 'none',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '1.5rem', background: 'rgba(255,255,255,0.08)' }} />

      {/* From / To Date Inputs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">From</label>
          <input
            type="date"
            value={draft.from}
            max={draft.to || todayStr()}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className="date-input-custom"
          />
        </div>

        <FiChevronRight className="text-slate-600 text-sm flex-shrink-0 mt-3" />

        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">To</label>
          <input
            type="date"
            value={draft.to}
            min={draft.from}
            max={todayStr()}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className="date-input-custom"
          />
        </div>
      </div>

      {/* Apply Button */}
      <button
        onClick={handleApply}
        disabled={!draft.from || !draft.to}
        className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all disabled:opacity-40"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.7), rgba(139,92,246,0.5))',
          border: '1px solid rgba(99,102,241,0.45)',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
        }}
      >
        <FiFilter className="text-sm" />
        Apply Filter
      </button>
    </div>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  sub?: string;
}

/** KPI summary card with colored icon, bold value, and sub-label */
const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, sub }) => (
  <div className="liquid-glass p-5 flex items-center gap-4">
    <div className="p-3 rounded-xl text-2xl flex-shrink-0" style={{ background: `${color}18`, color }}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{label}</p>
      <p
        className="text-xl font-extrabold mt-0.5 truncate"
        style={{ color: value.startsWith('$') ? color : '#fff' }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Chart Card ──────────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Glassmorphic wrapper card for a chart */
const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children }) => (
  <div className="liquid-glass p-5">
    <div className="mb-4">
      <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">{title}</h3>
      {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ─── Analytics Tab ────────────────────────────────────────────────────────────

interface AnalyticsTabProps {
  filter: DateFilter;
  stats: any;
}

/**
 * Full analytics view: period KPI strip + 5 charts (volume, settlements,
 * transactions, users, combined overview) + categories + activity log.
 * Re-fetches from API whenever `filter` changes (after Apply is clicked).
 */
const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ filter, stats }) => {
  const [data, setData] = useState<OvertimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /** Format YYYY-MM-DD → short label: "Aug 5" */
  const fmtDate = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  /** Adaptive X-axis tick interval to prevent label crowding */
  const getDayCount = () => {
    if (!data) return 30;
    return data.series.length;
  };
  const tickInterval = (() => {
    const n = getDayCount();
    if (n <= 8)  return 0;
    if (n <= 31) return 4;
    if (n <= 92) return 9;
    return 29;
  })();

  const loadAnalytics = useCallback(async () => {
    if (!filter.from || !filter.to) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(
        `/api/admin/analytics-overtime?startDate=${filter.from}&endDate=${filter.to}`
      );
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="loading loading-spinner loading-lg text-indigo-400" />
        <p className="text-slate-400 text-sm">Loading analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error max-w-xl mx-auto mt-6">
        <span>{error}</span>
        <button className="btn btn-sm btn-outline ml-4" onClick={loadAnalytics}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.series.map((d) => ({ ...d, label: fmtDate(d.date) }));
  const { totals } = data;

  /** Friendly label for the selected period */
  const periodLabel = `${fmtDate(data.startDate)} – ${fmtDate(data.endDate)}`;

  return (
    <div className="flex flex-col gap-6">

      {/* Period KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<FiDollarSign />}
          label="Volume"
          value={`$${totals.volume.toFixed(4)} USDC`}
          color="#10b981"
          sub={`Mainnet · ${periodLabel}`}
        />
        <MetricCard
          icon={<FiBarChart2 />}
          label="Settlements"
          value={`${totals.settlements}`}
          color="#818cf8"
          sub={`Completed payments · ${periodLabel}`}
        />
        <MetricCard
          icon={<FiActivity />}
          label="Transactions"
          value={`${totals.transactions}`}
          color="#60a5fa"
          sub={`Task runs · ${periodLabel}`}
        />
        <MetricCard
          icon={<FiUsers />}
          label="New Users"
          value={`${totals.newUsers}`}
          color="#c084fc"
          sub={`Registrations · ${periodLabel}`}
        />
      </div>

      {/* Charts Grid — 2 columns on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Volume Chart */}
        <ChartCard title="Usage Volume (USDC)" subtitle={`Daily mainnet payment volume · ${periodLabel}`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} interval={tickInterval} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={52} />
              <Tooltip content={<GlassTooltip prefix="$" />} />
              <Area type="monotone" dataKey="volume" name="Volume" stroke="#10b981" strokeWidth={2} fill="url(#volGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Settlements Chart */}
        <ChartCard title="Settlements" subtitle={`Daily completed payment count · ${periodLabel}`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="settleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} interval={tickInterval} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<GlassTooltip />} />
              <Bar dataKey="settlements" name="Settlements" fill="url(#settleGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Transactions Chart */}
        <ChartCard title="Transactions" subtitle={`Daily task execution count · ${periodLabel}`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} interval={tickInterval} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<GlassTooltip />} />
              <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#60a5fa" strokeWidth={2} fill="url(#txGrad)" dot={false} activeDot={{ r: 4, fill: '#60a5fa' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* New Users Chart */}
        <ChartCard title="New Users" subtitle={`Daily new user registrations · ${periodLabel}`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="usrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#c084fc" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#c084fc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} interval={tickInterval} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<GlassTooltip />} />
              <Area type="monotone" dataKey="newUsers" name="New Users" stroke="#c084fc" strokeWidth={2} fill="url(#usrGrad)" dot={false} activeDot={{ r: 4, fill: '#c084fc' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Combined Platform Overview — full width */}
        <div className="md:col-span-2">
          <ChartCard title="Platform Overview" subtitle={`Transactions vs Settlements combined · ${periodLabel}`}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ovTxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ovStGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} interval={tickInterval} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<GlassTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#60a5fa" strokeWidth={2} fill="url(#ovTxGrad)" dot={false} />
                <Area type="monotone" dataKey="settlements"  name="Settlements"  stroke="#818cf8" strokeWidth={2} fill="url(#ovStGrad)"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Popular Categories + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Popular Task Categories" subtitle="All-time execution counts by category">
          <div className="flex flex-col gap-3">
            {stats?.mostUsedCategories?.map((cat: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-900 pb-2">
                <span className="font-semibold text-slate-200">{cat.category}</span>
                <span className="admin-badge admin-badge--indigo">{cat.count} runs</span>
              </div>
            ))}
            {(!stats?.mostUsedCategories || stats.mostUsedCategories.length === 0) && (
              <p className="text-slate-500 text-xs">No runs recorded.</p>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Recent Activity Logs" subtitle="Latest platform-wide events">
          <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
            {stats?.recentActivity?.map((log: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-0.5 text-xs border-b border-slate-900 pb-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200">{log.action}</span>
                  <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <span className="text-slate-400">
                  User: {log.userId?.fullName || 'System/Guest'} ({log.userId?.email || 'N/A'})
                </span>
              </div>
            ))}
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <p className="text-slate-500 text-xs">No recent activity.</p>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

// ─── Main AdminDashboard Component ────────────────────────────────────────────

/**
 * Admin console with:
 * - Live KPI overview bar (DAU, revenue, total runs, users)
 * - From / To date picker bar with preset shortcuts (7D, 30D, 90D, All)
 * - Analytics tab: 5 charts that update based on the selected date range
 * - Users, Tasks, Payments (mainnet only), Endpoints data tables
 */
const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Default date filter: last 30 days
  const [appliedFilter, setAppliedFilter] = useState<DateFilter>({
    from: toDateStr(daysAgo(29)),
    to:   todayStr(),
  });

  /** Loads all static admin panel data in parallel */
  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, tasksRes, paymentsRes, endpointsRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
        api.get('/api/admin/tasks'),
        api.get('/api/admin/payments'),
        api.get('/api/admin/endpoints'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setTasks(tasksRes.data);
      setPayments(paymentsRes.data);
      setEndpoints(endpointsRes.data);
    } catch (err: any) {
      console.error('Failed to load admin dashboard data:', err);
      setError(err.response?.data?.error || 'Failed to load admin stats. Please check permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 w-full">
        <div className="loading loading-spinner loading-lg text-primary mb-3" />
        <p className="text-slate-400">Loading Prism Admin Console…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error max-w-xl mx-auto mt-10">
        <span>{error}</span>
        <button className="btn btn-sm btn-outline ml-4" onClick={loadAdminData}>Retry</button>
      </div>
    );
  }

  const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'analytics', label: 'Analytics',  icon: <FiTrendingUp /> },
    { key: 'users',     label: 'Users',       icon: <FiUsers /> },
    { key: 'tasks',     label: 'Tasks',       icon: <FiActivity /> },
    { key: 'payments',  label: 'Payments',    icon: <FiDollarSign /> },
    { key: 'endpoints', label: 'Endpoints',   icon: <FiServer /> },
  ];

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in py-6">

      {/* Page Title */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Platform Admin Terminal</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time SaaS operations, transaction tracking, and routing analytics.</p>
        </div>
        <button
          onClick={loadAdminData}
          className="btn btn-outline btn-sm flex items-center gap-2 text-slate-300"
          title="Refresh all data"
        >
          <FiRefreshCw className="text-base" />
          Refresh
        </button>
      </div>

      {/* KPI Stats Grid — always visible, platform-wide totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <MetricCard icon={<FiUsers />}      label="Active Users Today" value={`${stats?.dau || 0}`}                          color="#818cf8" sub="DAU" />
        <MetricCard icon={<FiDollarSign />} label="Platform Revenue"   value={`$${(stats?.revenue || 0).toFixed(2)} USDC`}  color="#10b981" sub="All time" />
        <MetricCard icon={<FiActivity />}   label="Total Runs"         value={`${stats?.totals?.tasks || 0}`}                color="#60a5fa" sub="Executions" />
        <MetricCard icon={<FiServer />}     label="Network Users"      value={`${stats?.totals?.users || 0}`}                color="#c084fc" sub="Registered" />
      </div>

      {/* Tabs Controller */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Picker Bar — visible only on Analytics tab */}
      {activeTab === 'analytics' && (
        <DatePickerBar filter={appliedFilter} onApply={setAppliedFilter} />
      )}

      {/* Tab Contents */}
      <div className="w-full">

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <AnalyticsTab filter={appliedFilter} stats={stats} />
        )}

        {/* USERS LIST TAB */}
        {activeTab === 'users' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Tasks Run</th>
                  <th>AI Spent</th>
                  <th>Saved</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="font-semibold text-white">{u.fullName}</td>
                    <td>{u.email}</td>
                    <td><span className="admin-badge admin-badge--indigo">{u.subscriptionPlan}</span></td>
                    <td>{u.totalTasks}</td>
                    <td className="font-bold text-emerald-400">${(u.totalSpent || 0).toFixed(2)} USDC</td>
                    <td>${(u.totalSaved || 0).toFixed(2)}</td>
                    <td>
                      <span className={`admin-badge ${u.role === 'admin' ? 'admin-badge--rose' : 'admin-badge--slate'}`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-500 py-8">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TASKS LIST TAB */}
        {activeTab === 'tasks' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Prompt</th>
                  <th>Category</th>
                  <th>Endpoint</th>
                  <th>Latency</th>
                  <th>Cost</th>
                  <th>Verification</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t._id}>
                    <td className="font-semibold text-white max-w-[120px] truncate">{t.userId?.fullName || 'Guest'}</td>
                    <td className="max-w-[200px] truncate" title={t.prompt}>{t.prompt}</td>
                    <td><span className="admin-badge admin-badge--slate">{t.category}</span></td>
                    <td className="text-[11px] font-mono">{t.selectedEndpoint || 'None'}</td>
                    <td>{t.executionTime ? `${t.executionTime}ms` : 'N/A'}</td>
                    <td className="font-bold text-emerald-400">${(t.endpointCost || 0).toFixed(3)} USDC</td>
                    <td>
                      <span className={`admin-badge ${
                        t.verificationStatus === 'passed'  ? 'admin-badge--green'
                        : t.verificationStatus === 'failed' ? 'admin-badge--rose'
                        : 'admin-badge--slate'
                      }`}>
                        {t.verificationStatus || 'unverified'}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${t.status === 'completed' ? 'admin-badge--green' : 'admin-badge--rose'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-slate-500 py-8">No tasks found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAYMENTS LIST TAB — Mainnet only */}
        {activeTab === 'payments' && (
          <div className="flex flex-col gap-3">
            {/* Mainnet-only notice */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-300"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <FiFilter className="text-emerald-400 flex-shrink-0" />
              Showing <strong className="mx-1">mainnet transactions only</strong> — testnet activity is excluded.
              <span className="ml-auto text-slate-500">{payments.length} records</span>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tx Signature</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Blockchain</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td className="font-mono text-[10px] max-w-[150px] truncate" title={p.x402TransactionId}>
                        {p.x402TransactionId}
                      </td>
                      <td className="font-semibold text-white">{p.userId?.fullName || 'N/A'}</td>
                      <td className="font-bold text-emerald-400">${p.amount.toFixed(2)} {p.currency}</td>
                      <td><span className="admin-badge admin-badge--indigo">{p.blockchain}</span></td>
                      <td><span className="admin-badge admin-badge--green">{p.status}</span></td>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-slate-500 py-8">No mainnet transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ENDPOINT USAGE TAB */}
        {activeTab === 'endpoints' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Endpoint URL</th>
                  <th>Provider</th>
                  <th>Response Time</th>
                  <th>Endpoint Cost</th>
                  <th>Verification Score</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr key={e._id}>
                    <td className="font-mono text-white">{e.endpointName}</td>
                    <td>{e.provider}</td>
                    <td>{e.responseTime}ms</td>
                    <td className="font-bold text-emerald-400">${(e.cost || 0).toFixed(3)} USDC</td>
                    <td>
                      <span className="admin-badge admin-badge--indigo">
                        {e.qualityScore !== undefined ? `${Math.round(e.qualityScore * 100)}%` : 'N/A'}
                      </span>
                    </td>
                    <td>{new Date(e.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
                {endpoints.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-8">No endpoint data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
