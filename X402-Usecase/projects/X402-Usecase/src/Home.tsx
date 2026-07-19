// src/components/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FiLink, FiCheckCircle, FiShield, FiFileText, FiBarChart2, FiLock, FiUser, FiLogOut } from 'react-icons/fi'
import ConnectWallet from './components/ConnectWallet'
import Weather from './components/Weather'
import Prism from './components/Prism'
import AdminDashboard from './components/AdminDashboard'
import { api, setAccessToken } from './utils/api'

interface HomeProps { }

const Home: React.FC<HomeProps> = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()

  // Derive view from URL
  const viewState = pathname === '/login' || pathname === '/signup'
    ? 'auth'
    : pathname === '/app'
      ? 'app'
      : 'landing'

  // Whether the auth form is in sign-up mode (driven by path)
  const isSignUp = pathname === '/signup'

  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('user')
  const [showProfileDropdown, setShowProfileDropdown] = useState<boolean>(false)
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [profileData, setProfileData] = useState<{ email: string; credits: number; plan: string } | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)

  const renderFormattedResult = (result: any, category: string) => {
    if (!result) return <p className="text-slate-400 text-xs">No data returned.</p>;

    if (category === 'resume_screening' && result.candidates) {
      return (
        <div className="overflow-x-auto w-full">
          <table className="table w-full text-slate-300">
            <thead>
              <tr className="text-indigo-400 border-b border-slate-800/80">
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Candidate Name</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Target/Matched Role</th>
                <th className="bg-transparent text-xs font-bold uppercase tracking-wider text-left py-2 px-3">Match Score</th>
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
                    <td className="w-1/4 py-2 px-3">
                      <div className="flex items-center gap-2">
                        <progress className={`progress ${progressClass} w-20 bg-slate-800`} value={scorePercent} max="100" />
                        <span className="font-extrabold text-xs text-slate-200">{scorePercent}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(c.key_skills) && c.key_skills.length > 0 ? (
                          c.key_skills.map((skill: string, sIdx: number) => (
                            <span key={sIdx} className="badge badge-sm badge-outline border-indigo-500/30 text-indigo-300 bg-indigo-950/20 px-2 py-0.5 rounded">{skill}</span>
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
    setAuthError('')

    if (!name || !email || !password || !confirmPassword) {
      setAuthError('All fields are required.')
      return
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }

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
    }
  }

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')

    if (!email || !password) {
      setAuthError('Please enter both email and password.')
      return
    }

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


  return (
    <div className="min-h-screen flex flex-col text-slate-100 font-sans relative overflow-x-hidden">
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

      {/* Top Navbar — visible only on app dashboard */}
      {viewState === 'app' && (
        <nav className="w-full flex items-center justify-between pt-6 pb-2 px-8 z-50 animate-fade-in">
          <div className="flex items-center gap-3 select-none">
            <img src="/logo.png" alt="Prism Logo" className="h-14 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-3">

            {viewState === 'app' && (
              <button
                className="btn btn-outline btn-primary btn-sm rounded-full px-4 text-xs font-semibold hover:scale-105 transition-transform"
                onClick={toggleWalletModal}
                data-test-id="connect-wallet"
              >
                {activeAddress ? `Connected: ${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}` : 'Connect Wallet'}
              </button>
            )}

            {viewState === 'app' && userRole !== 'admin' && (
              <button
                className="btn btn-ghost btn-sm text-slate-300 hover:text-white rounded-xl border border-slate-800/60 px-4 text-xs font-bold"
                onClick={() => {
                  fetchTasks();
                  setSelectedTask(null);
                  setShowHistoryModal(true);
                }}
              >
                History
              </button>
            )}

            {viewState === 'app' && currentUser && (
              <div className="relative">
                <button
                  className="btn btn-circle btn-ghost text-slate-300 hover:text-white hover:bg-slate-800/50 flex items-center justify-center border border-slate-800/60"
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

            {viewState === 'app' && currentUser && (
              <button
                className="btn btn-circle btn-ghost text-rose-450 hover:text-rose-400 hover:bg-rose-950/20 flex items-center justify-center border border-rose-950/30"
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
      <main className="flex-1 flex flex-col items-center z-10">

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
            <div className="lp-hero-content pt-16">


              <h1 className="lp-hero-heading">
                Decentralized AI Routing<br />
                <span className="lp-hero-gradient">
                  for Agentic Workflows
                </span>
              </h1>

              <p className="lp-hero-sub">
                Prism intelligently routes AI tasks to optimal endpoints — verified on-chain via Algorand, paid per task via x402. No subscriptions. No black boxes.
              </p>

              <div className="lp-hero-actions">
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

              {/* ── Trust Strip ── */}
              <div className="trust-strip">
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
                className="btn btn-primary w-full rounded-lg font-bold text-sm mt-2 shadow-lg shadow-indigo-500/10"
              >
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            </div>
          </div>
        )}

        {/* CHAT/WEATHER DASHBOARD VIEW */}
        {viewState === 'app' && (
          <div className={`w-full ${userRole === 'admin' ? 'max-w-7xl px-6 md:px-12 justify-start items-stretch pt-6' : 'max-w-4xl px-4 md:px-8 justify-center items-center'} flex-1 flex flex-col pb-24 gap-6`}>
            {userRole === 'admin' ? (
              <AdminDashboard />
            ) : (
              <Weather 
                activeTab="terminal" 
                setActiveTab={() => {}}
                onTaskComplete={fetchTasks} 
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
          <div className="w-full max-w-5xl liquid-glass p-6 rounded-3xl shadow-2xl flex flex-col gap-4 animate-scale-up max-h-[85vh] overflow-y-auto relative border border-white/10">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold p-2"
              onClick={() => {
                setShowHistoryModal(false);
                setSelectedTask(null);
              }}
            >
              ✕
            </button>
            <h3 className="text-lg font-extrabold text-white uppercase tracking-wider mb-2">Historical Run Logs</h3>
            
            {tasks.length === 0 ? (
              <p className="text-slate-500 text-sm">No tasks have been run yet.</p>
            ) : (
              <>
                <div className="admin-table-wrap max-h-[30vh] overflow-y-auto">
                  <table className="admin-table text-xs">
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
                          className={`cursor-pointer hover:bg-slate-800/40 transition-colors ${selectedTask?._id === task._id ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : ''}`}
                          onClick={() => setSelectedTask(task)}
                        >
                          <td className="max-w-[250px] truncate" title={task.prompt}>{task.prompt}</td>
                          <td><span className="admin-badge admin-badge--indigo">{task.category}</span></td>
                          <td className="font-mono text-[10px]">{task.selectedEndpoint || 'N/A'}</td>
                          <td>{task.executionTime ? `${task.executionTime}ms` : 'N/A'}</td>
                          <td className="font-bold text-emerald-400">${(task.totalCost ?? task.endpointCost ?? 0).toFixed(3)} USDC</td>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedTask && (
                  <div className="mt-4 border-t border-slate-800 pt-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                        Run Details
                      </h4>
                      <button 
                        className="btn btn-ghost btn-xs text-slate-400 hover:text-white rounded px-2"
                        onClick={() => setSelectedTask(null)}
                      >
                        Clear Details
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Result */}
                      <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                          <h5 className="text-xs font-bold text-slate-350 uppercase tracking-wide">
                            Execution Result Output
                          </h5>
                          <span className="text-[10px] text-slate-500 font-medium">Category: {selectedTask.category}</span>
                        </div>
                        <div className="flex-1">
                          {renderFormattedResult(selectedTask.output || selectedTask.result, selectedTask.category)}
                        </div>
                      </div>

                      {/* Right: Transaction / Money Breakdown */}
                      <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="border-b border-slate-800/60 pb-2">
                          <h5 className="text-xs font-bold text-slate-350 uppercase tracking-wide">
                            Transaction & Money Breakdown
                          </h5>
                        </div>
                        
                        <div className="flex flex-col gap-2 text-xs text-slate-300">
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-500 font-medium">Winning Provider / Endpoint</span>
                            <span className="font-mono text-white text-[10px]">{selectedTask.providerName || selectedTask.selectedEndpoint || 'N/A'}</span>
                          </div>
                          
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-500 font-medium">Quantity</span>
                            <span className="font-semibold text-white">{selectedTask.executionQuantity ?? 1} unit(s)</span>
                          </div>
                          
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-500 font-medium">Unit Price</span>
                            <span className="font-semibold text-white">${(selectedTask.unitPrice ?? 0).toFixed(3)} USDC</span>
                          </div>
                          
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-500 font-medium">Execution Cost</span>
                            <span className="font-semibold text-white">${(selectedTask.executionCost ?? selectedTask.endpointCost ?? 0).toFixed(3)} USDC</span>
                          </div>
                          
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-500 font-medium">Platform Fee</span>
                            <span className="font-semibold text-white">${(selectedTask.platformFee ?? 0.75).toFixed(3)} USDC</span>
                          </div>

                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-500 font-medium">Latency</span>
                            <span className="font-semibold text-white">{selectedTask.executionTime ? `${selectedTask.executionTime}ms` : 'N/A'}</span>
                          </div>

                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-500 font-medium">Verification Status</span>
                            <span className="font-semibold capitalize text-indigo-300">{selectedTask.verificationStatus || 'unverified'}</span>
                          </div>
                          
                          <div className="flex justify-between border-t border-slate-800 pt-2 pb-1">
                            <span className="text-indigo-400 font-bold text-sm">Total Cost</span>
                            <span className="font-extrabold text-emerald-400 text-sm">
                              ${(selectedTask.totalCost ?? (selectedTask.executionCost ?? selectedTask.endpointCost ?? 0) + (selectedTask.platformFee ?? 0.75)).toFixed(3)} USDC
                            </span>
                          </div>
                          
                          {selectedTask.endpointChosenReason && (
                            <div className="mt-2 bg-indigo-950/25 border border-indigo-900/35 p-2.5 rounded-xl">
                              <span className="block text-[9px] font-extrabold text-indigo-400 uppercase mb-1">Routing Reason</span>
                              <p className="text-[10px] leading-normal text-slate-400">{selectedTask.endpointChosenReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

export default Home
