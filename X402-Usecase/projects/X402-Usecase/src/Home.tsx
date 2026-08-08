// src/components/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FiLink, FiCheckCircle, FiShield, FiFileText, FiBarChart2, FiLock, FiUser, FiLogOut, FiDollarSign, FiMap, FiPlus } from 'react-icons/fi'
import ConnectWallet from './components/ConnectWallet'
import PrismConsole from './components/PrismConsole'
import Prism from './components/Prism'
import AdminDashboard from './components/AdminDashboard'
// import WaitlistModal from './components/WaitlistModal'
import { api, setAccessToken } from './utils/api'
// import { fetchWaitlistCount } from './utils/waitlistApi'

interface HomeProps { }

const Home: React.FC<HomeProps> = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()

  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('user')

  /* ── Waitlist mode (disabled locally — live on deployed branch) ──
  const [showWaitlistModal, setShowWaitlistModal] = useState(false)
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const openWaitlist = () => {
    setMobileNavOpen(false)
    setShowWaitlistModal(true)
  }

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false)
    if (pathname !== '/') {
      navigate('/')
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100)
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleWaitlistSuccess = () => {
    fetchWaitlistCount()
      .then(setWaitlistCount)
      .catch(() => {})
  }
  ── end waitlist ── */

  // Derive view from URL
  const viewState = pathname === '/login' || pathname === '/signup'
    ? 'auth'
    : pathname === '/app'
      ? 'app'
      : 'landing'

  // Whether the auth form is in sign-up mode (driven by path)
  const isSignUp = pathname === '/signup'

  const [showProfileDropdown, setShowProfileDropdown] = useState<boolean>(false)
  const [showWalletDropdown, setShowWalletDropdown] = useState<boolean>(false)
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [profileData, setProfileData] = useState<{ email: string; credits: number; plan: string } | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [historyTab, setHistoryTab] = useState<'conversations' | 'tasks'>('conversations')

  const renderFormattedResult = (result: any, category: string) => {
    if (!result) return <p className="text-slate-400 text-xs">No data returned.</p>;

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
                <div key={index} className="collapse collapse-arrow bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3">
                  <div className="text-sm font-semibold flex items-center justify-between text-white">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-indigo-400 font-bold">📄 {f.file_path}</span>
                      <span className="text-xs text-slate-400">({fileIssues.length} issue{fileIssues.length !== 1 ? 's' : ''})</span>
                    </div>
                    <span className="badge bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-2 py-0.5">
                      Quality: {scorePct}%
                    </span>
                  </div>
                  <div className="text-slate-300 text-xs flex flex-col gap-3 mt-2">
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

    if (category === 'resume_screening' && result.candidates) {
      return (
        <div className="overflow-x-auto w-full">
          <table className="table w-full text-slate-300">
            <thead>
              <tr className="text-indigo-400 border-b border-slate-800/80">
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Candidate Name</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Target/Matched Role</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Match Score</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Primary Domain</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Alternative Fits</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Key Skills</th>
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
                    <td className="font-semibold text-white py-2 px-3">{c.name}</td>
                    <td className="text-slate-300 py-2 px-3">{c.role || 'N/A'}</td>
                    <td className="w-1/6 py-2 px-3">
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
                <div key={index} className="collapse collapse-arrow bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3">
                  <div className="text-sm font-semibold flex items-center gap-3 text-white">
                    <span className={`badge ${badgeColor} border badge-sm uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded text-[10px]`}>{clause.risk || 'Low'}</span>
                    <span className="text-slate-250 font-bold">{clause.type || 'Clause'}</span>
                  </div>
                  <div className="text-slate-300 text-xs flex flex-col gap-2 mt-2 pl-2">
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
                  {lineItems[0]?.item_code !== undefined && <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Item Code</th>}
                  <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Description</th>
                  {lineItems[0]?.quantity !== undefined && <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-right py-2 px-3">Qty</th>}
                  {lineItems[0]?.unit_price !== undefined && <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-right py-2 px-3">Unit Price</th>}
                  <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-right py-2 px-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    {item.item_code !== undefined && <td className="font-mono text-xs text-slate-400 py-2 px-3">{item.item_code}</td>}
                    <td className="text-white py-2 px-3">{item.description}</td>
                    {item.quantity !== undefined && <td className="text-right text-slate-300 py-2 px-3">{item.quantity}</td>}
                    {item.unit_price !== undefined && <td className="text-right text-slate-300 py-2 px-3">${Number(item.unit_price).toFixed(2)}</td>}
                    <td className="text-right font-semibold text-white py-2 px-3">${Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t border-slate-800 bg-indigo-950/20 text-indigo-300">
                  <td colSpan={lineItems[0]?.quantity !== undefined ? 4 : 2} className="text-right py-2 px-3">Total:</td>
                  <td className="text-right font-extrabold text-white text-base py-2 px-3">${totalAmount.toFixed(2)}</td>
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

  // Fetch past task executions
  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/api/analytics/tasks');
      setTasks(data);
    } catch (err) {
      console.error('Error fetching task history:', err);
    }
  };

  // Auth Inputs
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)

  // Check login on load — redirect to /app if already signed in
  useEffect(() => {
    const savedUser = localStorage.getItem('prism_logged_in_user')
    const token = localStorage.getItem('prism_access_token')
    const savedRole = localStorage.getItem('prism_user_role') || 'user'

    if (savedUser && token) {
      setCurrentUser(savedUser)
      setUserRole(savedRole)
      const savedEmail = localStorage.getItem('prism_user_email') || ''
      const savedCredits = Number(localStorage.getItem('prism_user_credits') || '0')
      const savedPlan = localStorage.getItem('prism_user_plan') || 'free'
      setProfileData({ email: savedEmail, credits: savedCredits, plan: savedPlan })
      fetchTasks()

      // Check session validity with me endpoint
      api.get('/api/auth/me')
        .then(() => {
          if (pathname !== '/app') navigate('/app', { replace: true })
        })
        .catch(() => {
          // Token expired or invalid
          handleLogout()
        })
    } else if (pathname === '/app') {
      navigate('/', { replace: true })
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Load user dashboard stats when in app
  useEffect(() => {
    if (viewState === 'app' && currentUser && userRole !== 'admin') {
      api.get('/api/analytics/dashboard')
        .then(({ data }) => setStats(data))
        .catch(err => console.error("Error loading dashboard stats", err));
    }
  }, [viewState, currentUser, userRole])

  // Sync wallet address to backend when activeAddress changes
  useEffect(() => {
    if (activeAddress && currentUser) {
      api.post('/api/auth/connect-wallet', { walletAddress: activeAddress })
        .then(() => console.log('Wallet address synced to backend'))
        .catch(err => console.error('Failed to sync wallet address', err));
    }
  }, [activeAddress, currentUser])

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  // Handle Signup
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (authSubmitting) return;
    setAuthError('')

    if (!name || !email || !password || !confirmPassword) {
      setAuthError('All fields are required.')
      return
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }

    setAuthSubmitting(true);
    try {
      const { data } = await api.post('/api/auth/signup', {
        fullName: name,
        email,
        password,
      });

      setAccessToken(data.accessToken);
      localStorage.setItem('prism_refresh_token', data.refreshToken);
      localStorage.setItem('prism_logged_in_user', data.user.fullName);
      localStorage.setItem('prism_user_role', data.user.role);
      localStorage.setItem('prism_user_email', data.user.email);
      localStorage.setItem('prism_user_credits', data.user.credits?.toString() || '0');
      localStorage.setItem('prism_user_plan', data.user.subscriptionPlan || 'free');

      setCurrentUser(data.user.fullName);
      setUserRole(data.user.role);
      setProfileData({
        email: data.user.email,
        credits: data.user.credits || 0,
        plan: data.user.subscriptionPlan || 'free'
      });
      navigate('/app');

      // Reset inputs
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Signup failed.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (authSubmitting) return;
    setAuthError('')

    if (!email || !password) {
      setAuthError('Please enter both email and password.')
      return
    }

    setAuthSubmitting(true);
    try {
      const { data } = await api.post('/api/auth/login', {
        email,
        password,
      });

      setAccessToken(data.accessToken);
      localStorage.setItem('prism_refresh_token', data.refreshToken);
      localStorage.setItem('prism_logged_in_user', data.user.fullName);
      localStorage.setItem('prism_user_role', data.user.role);
      localStorage.setItem('prism_user_email', data.user.email);
      localStorage.setItem('prism_user_credits', data.user.credits?.toString() || '0');
      localStorage.setItem('prism_user_plan', data.user.subscriptionPlan || 'free');

      setCurrentUser(data.user.fullName);
      setUserRole(data.user.role);
      setProfileData({
        email: data.user.email,
        credits: data.user.credits || 0,
        plan: data.user.subscriptionPlan || 'free'
      });
      navigate('/app');

      // Reset inputs
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Login failed.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('prism_refresh_token');
    try {
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (err) {
      console.error('Logout error on backend:', err);
    }
    setAccessToken(null);
    localStorage.removeItem('prism_refresh_token');
    localStorage.removeItem('prism_logged_in_user');
    localStorage.removeItem('prism_user_role');
    localStorage.removeItem('prism_user_email');
    localStorage.removeItem('prism_user_credits');
    localStorage.removeItem('prism_user_plan');

    setCurrentUser(null);
    setUserRole('user');
    setProfileData(null);
    setShowProfileDropdown(false);
    navigate('/');
  }


  const [savingsSummary, setSavingsSummary] = useState<{
    total_raw_tokens?: number;
    total_map_tokens?: number;
    total_tokens_saved?: number;
    average_reduction_percent?: number;
    estimated_usd_saved?: number;
    savings_multiplier?: number;
    total_requests_processed?: number;
    cache_hit_rate_percent?: number;
    total_documents_processed?: number;
  } | null>(null)

  const [showSavingsModal, setShowSavingsModal] = useState<boolean>(false)
  const [displayedSavings, setDisplayedSavings] = useState<number>(0)
  const [isPulsing, setIsPulsing] = useState<boolean>(false)

  const fetchSavingsSummary = async () => {
    try {
      const { data } = await api.get('/savings-summary')
      if (data && typeof data.estimated_usd_saved === 'number') {
        const newTarget = data.estimated_usd_saved
        setSavingsSummary(data)

        setDisplayedSavings((prev) => {
          if (newTarget > prev && prev > 0) {
            // Trigger pulse effect
            setIsPulsing(true)
            setTimeout(() => setIsPulsing(false), 1000)

            // Smooth count-up animation over ~600ms
            const startVal = prev
            const duration = 600
            const startTime = performance.now()

            const animateCount = (currentTime: number) => {
              const elapsed = currentTime - startTime
              const progress = Math.min(elapsed / duration, 1)
              const currentVal = startVal + (newTarget - startVal) * progress
              setDisplayedSavings(currentVal)
              if (progress < 1) {
                requestAnimationFrame(animateCount)
              }
            }
            requestAnimationFrame(animateCount)
            return prev
          } else {
            return newTarget
          }
        })
      } else {
        setSavingsSummary(null)
      }
    } catch (err) {
      console.error('Failed to fetch savings summary:', err)
      setSavingsSummary(null)
    }
  }

  useEffect(() => {
    if (viewState === 'app') {
      fetchSavingsSummary()
    }
  }, [viewState])

  return (
    <div className={`w-full text-slate-100 font-sans relative ${viewState === 'app' ? 'min-h-screen flex flex-col' : 'min-h-screen flex flex-col overflow-x-hidden'}`}>
      {/* Background backdrop and Prism */}
      <div className="fixed inset-0 bg-slate-950 -z-20" />
      <div className="fixed inset-0 -z-10 opacity-70 pointer-events-none">
        <Prism
          animationType="rotate"
          timeScale={0.8}
          height={3.5}
          baseWidth={5.5}
          scale={3.5}
          hueShift={0}
          colorFrequency={1}
          noise={0.3}
          glow={0.8}
          offset={{ x: 0, y: -120 }}
        />
      </div>

      {/* Top Navbar — fixed overlay with top vignette shade on app dashboard */}
      {viewState === 'app' && (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between pt-6 pb-10 px-8 animate-fade-in pointer-events-none bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent">
          <div className="flex items-center gap-3 select-none pointer-events-auto">
            <img src="/logo.png" alt="Prism Logo" className="h-14 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">

            {/* 1. New Chat — always first */}
            {viewState === 'app' && userRole !== 'admin' && (
              <button
                className="btn h-10 min-h-[40px] text-emerald-300 hover:text-white rounded-full border border-emerald-500/40 px-4 text-xs font-bold flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/22 transition-all"
                onClick={() => window.dispatchEvent(new CustomEvent('prism_new_chat'))}
              >
                <FiPlus className="text-sm text-emerald-400" />
                <span>New Chat</span>
              </button>
            )}

            {/* 2. Data Maps */}
            {viewState === 'app' && userRole !== 'admin' && (
              <button
                className="btn h-10 min-h-[40px] text-indigo-300 hover:text-white rounded-full border border-indigo-500/30 px-4 text-xs font-bold flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/22 transition-all"
                onClick={() => window.dispatchEvent(new CustomEvent('prism_toggle_data_maps_view'))}
              >
                <FiMap className="text-sm text-indigo-400" />
                <span>Data Maps</span>
              </button>
            )}

            {/* 3. History */}
            {viewState === 'app' && userRole !== 'admin' && (
              <button
                className="btn h-10 min-h-[40px] text-slate-300 hover:text-white rounded-full border border-slate-700/50 px-4 text-xs font-bold hover:bg-slate-800/40 transition-all"
                onClick={() => {
                  api.get('/api/chat/conversations').then(({ data }) => setConversations(data)).catch(() => { });
                  api.get('/api/analytics/tasks').then(({ data }) => setTasks(data)).catch(() => { });
                  setHistoryTab('conversations');
                  setSelectedTask(null);
                  setShowHistoryModal(true);
                }}
              >
                History
              </button>
            )}

            {/* 4. Savings pill */}
            {viewState === 'app' && savingsSummary && (
              <button
                className={`btn h-10 min-h-[40px] rounded-full px-4 text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 ${isPulsing
                  ? 'bg-emerald-500 text-slate-950 scale-110 shadow-lg shadow-emerald-500/40 border-emerald-400'
                  : 'bg-slate-900/80 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-400'
                  }`}
                onClick={() => setShowSavingsModal(true)}
              >
                <FiDollarSign className="text-emerald-400 text-sm" />
                <span>${displayedSavings.toFixed(2)} saved</span>
              </button>
            )}


            {/* 6. Wallet button — red if disconnected, green address if connected */}
            {viewState === 'app' && (
              <div className="relative">
                <button
                  className={`btn h-10 min-h-[40px] rounded-full px-4 text-xs font-bold flex items-center gap-1.5 border transition-all hover:scale-105 ${
                    activeAddress
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 font-mono'
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                  }`}
                  onClick={() => setShowWalletDropdown((p: boolean) => !p)}
                  data-test-id="connect-wallet"
                >
                  {activeAddress
                    ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`
                    : 'Connect Wallet'
                  }
                </button>

                {showWalletDropdown && (
                  <div className="absolute right-0 mt-3 w-80 bg-slate-900/97 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-[60] flex flex-col overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-slate-800/70 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeAddress ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-800 border border-slate-700'}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${activeAddress ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{activeAddress ? 'Wallet Connected' : 'No Wallet Connected'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Algorand · {(import.meta.env.VITE_ALGOD_NETWORK || 'mainnet').toUpperCase()}</p>
                      </div>
                    </div>

                    {activeAddress && (
                      <div className="px-5 py-4 flex flex-col gap-3 border-b border-slate-800/70">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1.5">Wallet Address</p>
                          <p className="text-xs font-mono text-slate-200 break-all leading-relaxed bg-slate-800/60 rounded-xl px-3 py-2.5">
                            {activeAddress}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-medium">Short form</span>
                          <span className="text-xs font-mono text-indigo-300 font-bold">
                            {activeAddress.slice(0, 8)}…{activeAddress.slice(-6)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="px-5 py-3">
                      {activeAddress ? (
                        <button
                          className="btn btn-sm w-full rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 font-bold text-xs"
                          onClick={() => { toggleWalletModal(); setShowWalletDropdown(false); }}
                        >
                          Manage / Disconnect Wallet
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm w-full rounded-xl btn-primary font-bold text-xs"
                          onClick={() => { toggleWalletModal(); setShowWalletDropdown(false); }}
                        >
                          Connect Wallet
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. Profile dropdown */}
            {viewState === 'app' && currentUser && (
              <div className="relative">
                <button
                  className="btn btn-circle h-10 w-10 min-h-[40px] min-w-[40px] btn-ghost text-slate-300 hover:text-white hover:bg-slate-800/50 flex items-center justify-center border border-slate-800/60"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                >
                  <FiUser className="text-lg" />
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-3 w-72 bg-slate-900/95 backdrop-blur-lg border border-slate-800/90 rounded-2xl p-5 shadow-2xl z-50 flex flex-col gap-4 animate-fade-in text-left">
                    <div className="border-b border-slate-800/60 pb-3">
                      <p className="text-sm font-bold text-white leading-tight">{currentUser}</p>
                      <p className="text-xs text-slate-400 mt-1">{profileData?.email || 'No email'}</p>
                    </div>
                    <div className="flex flex-col gap-2.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Subscription:</span>
                        <span className="badge badge-outline badge-primary badge-sm font-bold uppercase text-[9px]">{profileData?.plan || 'free'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Remaining Credits:</span>
                        <span className="font-extrabold text-indigo-400">{profileData?.credits ?? 0} runs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Role:</span>
                        <span className="font-bold text-slate-400 capitalize">{userRole}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-error btn-sm w-full rounded-xl text-xs font-bold text-white mt-2"
                      onClick={handleLogout}
                    >
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 8. Logout shortcut */}
            {viewState === 'app' && currentUser && (
              <button
                className="btn btn-circle h-10 w-10 min-h-[40px] min-w-[40px] btn-ghost text-rose-450 hover:text-rose-400 hover:bg-rose-950/20 flex items-center justify-center border border-rose-950/30"
                onClick={handleLogout}
                title="Log Out"
              >
                <FiLogOut className="text-lg" />
              </button>
            )}

          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center z-10 w-full">

        {/* LANDING PAGE VIEW */}
        {viewState === 'landing' && (
          <div className="lp-hero-wrap w-full animate-fade-in relative">

            {/* Floating Top-Left Logo */}
            <div
              className="absolute top-10 left-6 md:left-8 cursor-pointer z-50 transition-transform hover:scale-105"
              onClick={() => navigate('/')}
            >
              <img src="/logo.png" alt="Prism Logo" className="h-14 w-auto object-contain" />
            </div>

            {/* Floating Top-Right Sign In */}
            <div className="absolute top-10 right-6 md:right-8 z-50">
              <button
                className="btn btn-outline btn-sm rounded-full px-6 text-xs font-semibold hover:bg-white/10 hover:scale-105 transition-all"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
            </div>

            {/* ── Hero ── */}
            <div className="lp-hero-content pt-10 md:pt-14">

              <h1 className="lp-hero-heading mb-6">
                Stop paying for AI tools<br />
                <span className="lp-hero-gradient">you barely use.</span>
              </h1>

              <p className="lp-hero-sub mb-6">
                Ask for what you need: screening, contracts, invoices.
              </p>

              {/* ── Trust Strip ── */}
              <div className="trust-strip my-6">
                <span className="trust-badge">
                  <span className="trust-icon"><FiCheckCircle /></span>
                  No subscriptions — pay only when you use it
                </span>

                <span className="trust-divider" />
                <span className="trust-badge">
                  <span className="trust-icon"><FiLink /></span>
                  Secured on Algorand
                </span>
              </div>

              <div className="lp-hero-actions mt-4 mb-8">
                <button
                  className="btn btn-primary btn-lg rounded-full px-10 font-bold shadow-xl shadow-indigo-500/25 hover:scale-105 transition-transform"
                  onClick={() => { navigate('/signup') }}
                >
                  Get Started Free
                </button>
                <button
                  className="btn btn-outline btn-lg rounded-full px-10 font-bold hover:scale-105 transition-transform"
                  onClick={() => { navigate('/login') }}
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Capability Cards — full-width section ── */}
        {viewState === 'landing' && (
          <section className="lp-section w-full">
            <div className="lp-section-inner">
              <p className="lp-eyebrow">Capabilities</p>
              <h2 className="lp-section-heading">Built for real AI workloads</h2>
              <p className="lp-section-sub">
                Three production-ready task types — routed, priced, and verified on every run.
              </p>
              <div className="capability-grid">
                {/* Card 1 */}
                <div className="cap-card cap-card--indigo">
                  <div className="cap-icon-wrap cap-icon-wrap--indigo">
                    <FiFileText />
                  </div>
                  <h3 className="cap-title">Resume Screening</h3>
                  <p className="cap-body">
                    Evaluate candidates against target job descriptions using optimized LLM models with verified, auditable output.
                  </p>
                  <ul className="cap-features">
                    <li><FiCheckCircle className="cap-feat-icon" /> JD matching score</li>
                    <li><FiCheckCircle className="cap-feat-icon" /> On-chain verification</li>
                    <li><FiCheckCircle className="cap-feat-icon" /> Pay per result</li>
                  </ul>
                </div>

                {/* Card 2 */}
                <div className="cap-card cap-card--blue">
                  <div className="cap-icon-wrap cap-icon-wrap--blue">
                    <FiBarChart2 />
                  </div>
                  <h3 className="cap-title">Invoice Extraction</h3>
                  <p className="cap-body">
                    Extract line items, quantities, and values from documents instantly with perfect, structured JSON output.
                  </p>
                  <ul className="cap-features">
                    <li><FiCheckCircle className="cap-feat-icon" /> Structured JSON output</li>
                    <li><FiCheckCircle className="cap-feat-icon" /> Multi-format support</li>
                    <li><FiCheckCircle className="cap-feat-icon" /> Sub-second routing</li>
                  </ul>
                </div>

                {/* Card 3 */}
                <div className="cap-card cap-card--purple">
                  <div className="cap-icon-wrap cap-icon-wrap--purple">
                    <FiLock />
                  </div>
                  <h3 className="cap-title">Contract Analysis</h3>
                  <p className="cap-body">
                    Analyze legal documents to detect risk clauses and receive professional mitigation suggestions instantly.
                  </p>
                  <ul className="cap-features">
                    <li><FiCheckCircle className="cap-feat-icon" /> Risk clause detection</li>
                    <li><FiCheckCircle className="cap-feat-icon" /> Mitigation advice</li>
                    <li><FiCheckCircle className="cap-feat-icon" /> Verified result hash</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Pricing — full-width section ── */}
        {viewState === 'landing' && (
          <section id="pricing" className="lp-section lp-section--alt w-full">
            <div className="lp-section-inner">
              <p className="lp-eyebrow">Pricing</p>
              <h2 className="lp-section-heading">Only pay when it runs</h2>
              <p className="lp-section-sub">
                No seat licenses. No idle spend. Every dollar goes to work.
              </p>
              <div className="pricing-grid">
                {/* Subscription — foil */}
                <div className="pricing-card">
                  <p className="pricing-label">Traditional SaaS</p>
                  <p className="pricing-amount">Flat fee / mo</p>
                  <p className="pricing-caption">Pay whether you use it or not.</p>
                  <ul className="pricing-features">
                    <li className="pricing-feat pricing-feat--no"><span>✕</span> Monthly subscription</li>
                    <li className="pricing-feat pricing-feat--no"><span>✕</span> Pay for idle capacity</li>
                    <li className="pricing-feat pricing-feat--no"><span>✕</span> Black-box results</li>
                  </ul>
                </div>

                {/* Pay-per-task — hero */}
                <div className="pricing-card pricing-card--highlight">
                  <div className="pricing-badge">Recommended</div>
                  <p className="pricing-label">Prism Pay-per-task</p>
                  <p className="pricing-amount pricing-amount--highlight">$0.15 – $0.75</p>
                  <p className="pricing-caption">per task · billed in real time</p>
                  <ul className="pricing-features">
                    <li className="pricing-feat pricing-feat--yes"><FiCheckCircle /> No subscription needed</li>
                    <li className="pricing-feat pricing-feat--yes"><FiCheckCircle /> Pay only for what runs</li>
                    <li className="pricing-feat pricing-feat--yes"><FiCheckCircle /> On-chain verified results</li>
                  </ul>
                  <button
                    className="btn btn-primary w-full mt-6 rounded-xl font-bold text-sm"
                    onClick={() => { navigate('/signup') }}
                  >
                    Get Started Free
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Final CTA — full-width section ── */}
        {viewState === 'landing' && (
          <section className="lp-cta-section w-full">
            <div className="lp-cta-inner">
              <p className="lp-eyebrow lp-eyebrow--light">Get started today</p>
              <h2 className="lp-cta-heading">Ready to route your first task?</h2>
              <p className="lp-cta-sub">
                Sign up in seconds. No credit card required. Your first result is on us.
              </p>
              <div className="flex gap-4 flex-wrap justify-center mt-8">
                <button
                  className="btn btn-primary btn-lg rounded-full px-10 text-sm font-bold shadow-2xl shadow-indigo-500/30 hover:scale-105 transition-transform"
                  onClick={() => { navigate('/signup') }}
                >
                  Get Started — It's Free
                </button>
                <button
                  className="btn btn-outline btn-lg rounded-full px-10 text-sm font-bold hover:scale-105 transition-transform"
                  onClick={() => { navigate('/login') }}
                >
                  Sign In
                </button>
              </div>
              <p className="lp-cta-footnote">Powered by Algorand · x402 payments · GoPlausible verification</p>
            </div>
          </section>
        )}

        {/* ── Waitlist section (disabled locally — live on deployed branch) ──
        {viewState === 'landing' && (
          <section id="waitlist" className="lp-section w-full">...</section>
        )}
        ── end waitlist section ── */}

        {/* AUTH VIEW (LOGIN / SIGNUP) */}
        {viewState === 'auth' && (
          <div className="auth-screen">

            {/* Top-left logo — click to return to landing */}
            <div
              className="auth-logo-link"
              onClick={() => navigate('/')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/')}
              aria-label="Back to home"
            >
              <img src="/logo.png" alt="Prism" className="h-14 w-auto object-contain" />
            </div>

            {/* Centered card */}
            <div className="w-full max-w-md liquid-glass p-8 animate-scale-up">

              {/* Form Toggle Tabs */}
              <div className="flex border-b border-slate-800 mb-6">
                <button
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${!isSignUp ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  onClick={() => {
                    navigate('/login')
                    setAuthError('')
                  }}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${isSignUp ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  onClick={() => {
                    navigate('/signup')
                    setAuthError('')
                  }}
                >
                  Sign Up
                </button>
              </div>

              <h2 className="text-2xl font-extrabold text-white mb-2">
                {isSignUp ? 'Create your Account' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                {isSignUp ? 'Sign up to start screening and extracting documents.' : 'Sign in to access your Prism AI routing terminal.'}
              </p>

              {authError && (
                <div className="bg-rose-950/40 border border-rose-900/50 text-rose-350 text-xs p-3 rounded-lg mb-4">
                  {authError}
                </div>
              )}

              <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="flex flex-col gap-4">
                {isSignUp && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-300">Full Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="input input-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Email Address</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    className="input input-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="input input-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {isSignUp && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-300">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input input-bordered bg-slate-950/60 border-slate-800 text-sm focus:border-indigo-500 focus:outline-none"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="btn btn-primary w-full rounded-lg font-bold text-sm mt-2 shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  {authSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-xs text-white" />
                      <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                    </>
                  ) : (
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CHAT/WEATHER DASHBOARD VIEW */}
        {viewState === 'app' && (
          <div className={`w-full ${userRole === 'admin' ? 'max-w-7xl px-6 md:px-12 justify-start items-stretch pt-6' : 'max-w-6xl px-4 md:px-8 justify-center items-center'} flex-1 flex flex-col gap-6`}>
            {userRole === 'admin' ? (
              <AdminDashboard />
            ) : (
              <PrismConsole
                activeTab="terminal"
                setActiveTab={() => { }}
                selectedHistoryTask={selectedTask}
                onTaskComplete={() => {
                  fetchTasks();
                  fetchSavingsSummary();
                }}
              />
            )}
          </div>
        )}

      </main>

      {/* ── Site Footer (landing only) ── */}
      {viewState === 'landing' && (
        <footer className="lp-footer">
          <div className="lp-footer-inner">

            {/* Brand column */}
            <div className="lp-footer-brand">
              <img src="/logo.png" alt="Prism" className="lp-footer-logo" />
              <p className="lp-footer-tagline">
                AI task routing — verified on-chain,<br />paid per result.
              </p>
            </div>

            {/* Product links */}
            <div className="lp-footer-col">
              <p className="lp-footer-col-title">Product</p>
              <ul className="lp-footer-links">
                <li><a href="#pricing" className="lp-footer-link">Pricing</a></li>
                <li><button className="lp-footer-link" onClick={() => { navigate('/signup') }}>Get Started</button></li>
                <li><button className="lp-footer-link" onClick={() => { navigate('/login') }}>Sign In</button></li>
              </ul>
            </div>

            {/* Capabilities */}
            <div className="lp-footer-col">
              <p className="lp-footer-col-title">Capabilities</p>
              <ul className="lp-footer-links">
                <li><span className="lp-footer-link">Resume Screening</span></li>
                <li><span className="lp-footer-link">Invoice Extraction</span></li>
                <li><span className="lp-footer-link">Contract Analysis</span></li>
              </ul>
            </div>

            {/* Built with */}
            <div className="lp-footer-col">
              <p className="lp-footer-col-title">Built With</p>
              <div className="lp-footer-tech">
                <span className="lp-tech-badge"><FiLink className="inline mr-1" />Algorand</span>
                <span className="lp-tech-badge"><FiShield className="inline mr-1" />x402</span>
                <span className="lp-tech-badge"><FiCheckCircle className="inline mr-1" />GoPlausible</span>
              </div>
            </div>

          </div>

          {/* Bottom bar */}
          <div className="lp-footer-bar">
            <p className="lp-footer-copy">© {new Date().getFullYear()} Prism. All rights reserved.</p>
            <p className="lp-footer-copy">Built for the Global x402 Challenge · Algorand</p>
          </div>
        </footer>
      )}

      {/* History Modal Overlay */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl liquid-glass p-8 rounded-3xl shadow-2xl flex flex-col gap-5 animate-scale-up max-h-[90vh] overflow-y-auto relative border border-white/10">
            <button
              className="absolute top-5 right-5 text-slate-400 hover:text-white text-xl font-bold p-2"
              onClick={() => {
                setShowHistoryModal(false);
                setSelectedTask(null);
              }}
            >
              ✕
            </button>
            <h3 className="text-xl font-extrabold text-white uppercase tracking-wider mb-1">History</h3>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800/60 mb-2">
              <button
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all ${historyTab === 'conversations'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                onClick={() => setHistoryTab('conversations')}
              >
                💬 Conversations ({conversations.length})
              </button>
              <button
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all ${historyTab === 'tasks'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                onClick={() => setHistoryTab('tasks')}
              >
                📋 Task Logs ({tasks.length})
              </button>
            </div>

            {/* Conversations Tab */}
            {historyTab === 'conversations' && (
              conversations.length === 0 ? (
                <p className="text-slate-500 text-sm">No saved conversations yet. Start a chat and your thread will be saved automatically.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
                  {conversations.map((convo) => (
                    <button
                      key={convo._id}
                      className="w-full text-left px-4 py-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/60 hover:border-indigo-500/40 rounded-xl transition-all group"
                      onClick={() => {
                        setShowHistoryModal(false);
                        // Tag with _type so Weather.tsx knows this is a full conversation
                        setSelectedTask({ ...convo, _type: 'conversation' });
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src="/icon.png" alt="Prism" className="w-5 h-5 rounded-full object-contain shrink-0 opacity-70 group-hover:opacity-100" />
                          <span className="text-sm font-semibold text-slate-100 truncate group-hover:text-white">{convo.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {convo.thread?.length > 0 && (
                            <span className="text-[10px] text-slate-500 font-medium">{convo.thread.length} message{convo.thread.length !== 1 ? 's' : ''}</span>
                          )}
                          <span className="text-[10px] text-slate-600">
                            {new Date(convo.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* Tasks Tab */}
            {historyTab === 'tasks' && (
              tasks.length === 0 ? (
                <p className="text-slate-500 text-sm">No tasks have been run yet.</p>
              ) : (
                <>
                  <div className="admin-table-wrap max-h-[55vh] overflow-y-auto">
                    <table className="admin-table text-xs w-full">
                      <thead>
                        <tr>
                          <th>Prompt</th>
                          <th>Category</th>
                          <th>Winning Endpoint</th>
                          <th>Latency</th>
                          <th>Cost</th>
                          <th>Verification</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr
                            key={task._id}
                            className="cursor-pointer hover:bg-slate-800/50 transition-colors border-b border-slate-800/40"
                            onClick={() => {
                              setShowHistoryModal(false);
                              setSelectedTask(task);
                            }}
                          >
                            <td className="max-w-[280px] truncate py-3 text-slate-100 font-medium" title={task.prompt}>{task.prompt}</td>
                            <td><span className="admin-badge admin-badge--indigo">{task.category}</span></td>
                            <td className="font-mono text-[11px] text-slate-300">{task.selectedEndpoint || 'N/A'}</td>
                            <td className="text-slate-300">{task.executionTime ? `${task.executionTime}ms` : 'N/A'}</td>
                            <td className="font-bold text-emerald-400 text-xs">${(task.totalCost ?? task.endpointCost ?? 0).toFixed(3)} USDC</td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Waitlist modal (disabled locally — live on deployed branch)
      <WaitlistModal
        open={showWaitlistModal}
        onClose={() => setShowWaitlistModal(false)}
        onSuccess={handleWaitlistSuccess}
      />
      */}

      {/* Savings Breakdown Modal Overlay */}
      {showSavingsModal && savingsSummary && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md liquid-glass p-6 rounded-3xl shadow-2xl flex flex-col gap-5 animate-scale-up relative border border-emerald-500/20">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold p-2"
              onClick={() => setShowSavingsModal(false)}
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FiDollarSign className="text-xl" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white tracking-tight">Cumulative Cost Savings</h3>
                <p className="text-xs text-slate-400">Prism LLM Optimization &amp; Caching Report</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Estimated USD Saved</span>
                <span className="text-xl font-black text-emerald-400">${(savingsSummary.estimated_usd_saved ?? 0).toFixed(2)}</span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Avg Efficiency Multiplier</span>
                <span className="text-xl font-black text-indigo-400">{savingsSummary.savings_multiplier ?? 2.5}x</span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Requests Processed</span>
                <span className="text-sm font-extrabold text-white">{savingsSummary.total_requests_processed ?? savingsSummary.total_documents_processed ?? 0}</span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Cache Hit / Token Reduction</span>
                <span className="text-sm font-extrabold text-white">{Math.round(savingsSummary.average_reduction_percent ?? 0)}%</span>
              </div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-2xl text-xs text-slate-300 flex flex-col gap-1.5">
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-400">Total Raw Tokens:</span>
                <span className="font-mono text-white font-semibold">{savingsSummary.total_raw_tokens ?? 0}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-400">Measured Input Context:</span>
                <span className="font-mono text-white font-semibold">{savingsSummary.total_map_tokens ?? 0}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-emerald-300 font-bold">Total Tokens Saved:</span>
                <span className="font-mono text-emerald-400 font-extrabold">{savingsSummary.total_tokens_saved ?? 0}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal text-center">
              On average, your workloads run <strong className="text-slate-300">{savingsSummary.savings_multiplier ?? 2.5}x more efficiently</strong> than unoptimized raw API calls by extracting reusable semantic document maps.
            </p>

            <button
              className="btn btn-primary rounded-xl text-xs font-bold w-full"
              onClick={() => setShowSavingsModal(false)}
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

export default Home
