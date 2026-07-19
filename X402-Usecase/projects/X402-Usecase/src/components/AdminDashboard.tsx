import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { FiUsers, FiDollarSign, FiActivity, FiServer, FiSettings } from 'react-icons/fi';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'tasks' | 'payments' | 'endpoints'>('stats');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

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

  useEffect(() => {
    loadAdminData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 w-full">
        <div className="loading loading-spinner loading-lg text-primary mb-3"></div>
        <p className="text-slate-400">Loading Prism Admin Console...</p>
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

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in py-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Platform Admin Terminal</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time SaaS operations, transaction tracking, and routing analytics.</p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <div className="liquid-glass p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl text-2xl"><FiUsers /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Users Today</p>
            <p className="text-2xl font-extrabold text-white mt-1">{stats?.dau || 0} active</p>
          </div>
        </div>

        <div className="liquid-glass p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-2xl"><FiDollarSign /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Revenue</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">${(stats?.revenue || 0).toFixed(2)} USDC</p>
          </div>
        </div>

        <div className="liquid-glass p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl text-2xl"><FiActivity /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Runs</p>
            <p className="text-2xl font-extrabold text-white mt-1">{stats?.totals?.tasks || 0} runs</p>
          </div>
        </div>

        <div className="liquid-glass p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl text-2xl"><FiServer /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Network Users</p>
            <p className="text-2xl font-extrabold text-white mt-1">{stats?.totals?.users || 0} registered</p>
          </div>
        </div>
      </div>

      {/* Tabs Controller */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        {(['stats', 'users', 'tasks', 'payments', 'endpoints'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === tab 
                ? 'border-indigo-500 text-white' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="w-full">
        {/* STATS OVERVIEW TAB */}
        {activeTab === 'stats' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="liquid-glass p-5">
                <h3 className="text-sm font-bold text-indigo-400 mb-4 uppercase tracking-wider">Popular task categories</h3>
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
              </div>

              <div className="liquid-glass p-5">
                <h3 className="text-sm font-bold text-indigo-400 mb-4 uppercase tracking-wider">Recent Activity Logs</h3>
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                  {stats?.recentActivity?.map((log: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-0.5 text-xs border-b border-slate-900 pb-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{log.action}</span>
                        <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <span className="text-slate-400">User: {log.userId?.fullName || 'System/Guest'} ({log.userId?.email || 'N/A'})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
                    <td><span className={`admin-badge ${u.role === 'admin' ? 'admin-badge--rose' : 'admin-badge--slate'}`}>{u.role}</span></td>
                  </tr>
                ))}
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
                      <span className={`admin-badge ${t.verificationStatus === 'passed' ? 'admin-badge--green' : t.verificationStatus === 'failed' ? 'admin-badge--rose' : 'admin-badge--slate'}`}>
                        {t.verificationStatus || 'unverified'}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${t.status === 'completed' ? 'admin-badge--green' : 'admin-badge--rose'}`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAYMENTS LIST TAB */}
        {activeTab === 'payments' && (
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
                    <td className="font-mono text-[10px] max-w-[150px] truncate" title={p.x402TransactionId}>{p.x402TransactionId}</td>
                    <td className="font-semibold text-white">{p.userId?.fullName || 'N/A'}</td>
                    <td className="font-bold text-emerald-400">${p.amount.toFixed(2)} {p.currency}</td>
                    <td>{p.blockchain}</td>
                    <td><span className="admin-badge admin-badge--green">{p.status}</span></td>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th>Endpoint cost</th>
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
                    <td><span className="admin-badge admin-badge--indigo">{e.qualityScore !== undefined ? `${Math.round(e.qualityScore * 100)}%` : 'N/A'}</span></td>
                    <td>{new Date(e.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
