// src/components/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FiLink, FiCheckCircle, FiShield, FiFileText, FiBarChart2, FiLock, FiUser, FiLogOut, FiDollarSign, FiMap, FiPlus, FiCode, FiUserCheck, FiGlobe, FiTv, FiCpu, FiLayers, FiZap, FiArrowRight, FiMail, FiTwitter, FiInstagram, FiLinkedin, FiGithub, FiMessageSquare, FiSend } from 'react-icons/fi'
import emailjs from '@emailjs/browser'
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
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; message?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contactStatus, setContactStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validateForm = () => {
    const errors: { name?: string; email?: string; message?: string } = {}
    if (!contactForm.name.trim()) {
      errors.name = 'Name is required'
    }
    if (!contactForm.email.trim()) {
      errors.email = 'Email is required'
    } else if (!validateEmail(contactForm.email.trim())) {
      errors.email = 'Please enter a valid email address'
    }
    if (!contactForm.message.trim()) {
      errors.message = 'Message is required'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!validateForm()) return

    setIsSubmitting(true)
    setContactStatus('idle')

    const serviceId = (import.meta.env.VITE_EMAILJS_SERVICE_ID || '').trim()
    const templateId = (import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '').trim()
    const publicKey = (import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '').trim()

    const templateParams = {
      from_name: contactForm.name.trim(),
      from_email: contactForm.email.trim(),
      message: contactForm.message.trim(),
    }

    try {
      if (serviceId && templateId && publicKey) {
        emailjs.init(publicKey)
        await emailjs.send(serviceId, templateId, templateParams)
      } else {
        console.warn('EmailJS variables missing in import.meta.env:', { serviceId, templateId, publicKey })
        throw new Error('EmailJS config missing')
      }
      setContactStatus('success')
    } catch (err: any) {
      console.error('EmailJS error details:', {
        status: err?.status,
        text: err?.text,
        error: err,
        sentConfig: { serviceId, templateId, publicKeyLength: publicKey.length }
      })
      setContactStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetContactForm = () => {
    setContactForm({ name: '', email: '', message: '' })
    setFormErrors({})
    setContactStatus('idle')
  }

  const renderFormattedResult = (result: any, category: string) => {
    if (!result) return <p className="text-slate-400 text-xs">No data returned.</p>;

    if (category === 'seo_audit' && result) {
      const pages = (result.pages ?? (result.page_url ? [result] : [])).filter((p: any) => p && typeof p.page_url === 'string' && p.page_url.trim() !== '');
      const totalPages = result.totalPagesAudited ?? pages.length;
      const totalIssues = result.totalIssues ?? pages.reduce((sum: number, p: any) => sum + (p.issues?.length || 0), 0);
      const severity = result.issuesBySeverity ?? {
        low: pages.flatMap((p: any) => p.issues ?? []).filter((i: any) => i.severity === 'low').length,
        medium: pages.flatMap((p: any) => p.issues ?? []).filter((i: any) => i.severity === 'medium').length,
        high: pages.flatMap((p: any) => p.issues ?? []).filter((i: any) => i.severity === 'high').length,
      };
      const overallScore = Math.round((result.overallSiteScore ?? (result.seo_score ?? 0.8)) * 100);

      return (
        <div className="flex flex-col gap-4 w-full text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Audited Pages</span>
              <span className="text-xl font-black text-white">{totalPages}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total SEO Issues</span>
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
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Overall Site Score</span>
              <span className="text-xl font-black text-emerald-400">{overallScore}%</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full mt-1">
            {pages.map((p: any, index: number) => {
              const pageIssues = p.issues || [];
              const scorePct = Math.round((p.seo_score ?? 0.8) * 100);
              return (
                <div key={index} className="collapse collapse-arrow bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3">
                  <div className="text-sm font-semibold flex items-center justify-between text-white">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-indigo-400 font-bold">🌐 {p.page_url}</span>
                      <span className="text-xs text-slate-400">({pageIssues.length} issue{pageIssues.length !== 1 ? 's' : ''})</span>
                    </div>
                    <span className="badge bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-2 py-0.5">
                      SEO Score: {scorePct}%
                    </span>
                  </div>
                  <div className="text-slate-300 text-xs flex flex-col gap-3 mt-2">
                    {pageIssues.length > 0 ? (
                      pageIssues.map((issue: any, iIdx: number) => {
                        let badgeColor = 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400';
                        if (issue.severity === 'high') badgeColor = 'bg-rose-500/15 border-rose-500/25 text-rose-400';
                        else if (issue.severity === 'medium') badgeColor = 'bg-amber-500/15 border-amber-500/25 text-amber-400';
                        return (
                          <div key={iIdx} className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/60 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`badge ${badgeColor} border text-[10px] font-extrabold uppercase px-2 py-0.5`}>
                                {issue.category || 'SEO'} · {issue.severity || 'low'}
                              </span>
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
                      <p className="text-slate-500 text-xs py-1">No SEO issues detected for this webpage.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
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

  // Sync wallet address to backend when activeAddress changes & auto-authenticate wallet connections
  useEffect(() => {
    if (activeAddress) {
      api.post('/api/auth/connect-wallet', { walletAddress: activeAddress })
        .then(({ data }) => {
          if (data?.accessToken) {
            setAccessToken(data.accessToken);
            if (data.refreshToken) localStorage.setItem('prism_refresh_token', data.refreshToken);
            if (data.user?.fullName) localStorage.setItem('prism_logged_in_user', data.user.fullName);
            if (data.user?.role) localStorage.setItem('prism_user_role', data.user.role);
            if (data.user?.email) localStorage.setItem('prism_user_email', data.user.email);
            if (data.user?.credits !== undefined) localStorage.setItem('prism_user_credits', data.user.credits.toString());
            if (data.user?.subscriptionPlan) localStorage.setItem('prism_user_plan', data.user.subscriptionPlan);

            setCurrentUser(data.user?.fullName || 'Wallet User');
            setUserRole(data.user?.role || 'user');
            setProfileData({
              email: data.user?.email || '',
              credits: data.user?.credits ?? 100,
              plan: data.user?.subscriptionPlan || 'free',
            });
            fetchTasks();
          }
        })
        .catch(err => console.error('Failed to sync wallet address', err));
    }
  }, [activeAddress])

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
    const handleTaskDone = () => {
      fetchSavingsSummary()
    }
    window.addEventListener('prism_task_completed', handleTaskDone)
    return () => {
      window.removeEventListener('prism_task_completed', handleTaskDone)
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
                  className={`btn h-10 min-h-[40px] rounded-full px-4 text-xs font-bold flex items-center gap-1.5 border transition-all hover:scale-105 ${activeAddress
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

            {/* Top Navbar Header */}
            <header className="absolute top-6 left-0 right-0 z-50 w-full px-6 md:px-12 flex items-center justify-between">
              {/* Top-Left Logo */}
              <div
                className="cursor-pointer transition-transform hover:scale-105 flex items-center shrink-0"
                onClick={() => navigate('/')}
              >
                <img src="/logo.png" alt="Prism Logo" className="h-10 md:h-12 w-auto object-contain" />
              </div>

              {/* Center Nav Links - Dedicated Glassmorphic Rectangle / Pill */}
              <div className="hidden md:flex items-center gap-1 lg:gap-2 px-5 py-2 rounded-full bg-slate-900/60 backdrop-blur-xl border border-white/10 border-t-white/20 shadow-xl shadow-indigo-950/30 absolute left-1/2 -translate-x-1/2">
                <button className="landing-nav-link whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-white/10 transition-all text-xs lg:text-sm" onClick={() => document.getElementById('what-prism-does')?.scrollIntoView({ behavior: 'smooth' })}>Overview</button>
                <button className="landing-nav-link whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-white/10 transition-all text-xs lg:text-sm" onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })}>Capabilities</button>
                <button className="landing-nav-link whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-white/10 transition-all text-xs lg:text-sm" onClick={() => document.getElementById('prism-difference')?.scrollIntoView({ behavior: 'smooth' })}>Intelligence</button>
                <button className="landing-nav-link whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-white/10 transition-all text-xs lg:text-sm" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pay-Per-Use</button>
                <button className="landing-nav-link whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-white/10 transition-all text-xs lg:text-sm" onClick={() => document.getElementById('traction')?.scrollIntoView({ behavior: 'smooth' })}>Traction</button>
              </div>

              {/* Top-Right Sign In */}
              <div className="flex items-center shrink-0">
                <button
                  className="btn btn-outline btn-sm rounded-full px-6 text-xs font-semibold hover:bg-white/10 hover:scale-105 transition-all"
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </button>
              </div>
            </header>

            {/* ── SECTION 01: HERO ── */}
            <div className="lp-hero-content relative z-10 pt-10 md:pt-14">

              <span className="lp-hero-eyebrow">
                AI ORCHESTRATION · PAY PER USE
              </span>

              <h1 className="lp-hero-heading mb-6">
                One Platform.<br />
                <span className="lp-hero-gradient">Every AI Task.</span>
              </h1>

              <p className="lp-hero-sub mb-6">
                Send the work. PRISM understands, routes, and executes it with specialized AI capabilities.
              </p>

              <div className="lp-hero-actions mt-4 mb-8">
                <button
                  className="btn btn-primary btn-lg rounded-full px-10 font-bold shadow-xl shadow-indigo-500/25 hover:scale-105 transition-transform flex items-center gap-2"
                  onClick={() => { navigate('/signup') }}
                >
                  <span>Get Started Free</span>
                  <FiArrowRight />
                </button>
                <button
                  className="btn btn-outline btn-lg rounded-full px-10 font-bold hover:scale-105 transition-transform"
                  onClick={() => { document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' }) }}
                >
                  Explore Capabilities
                </button>
              </div>

              {/* ── Trust Strip ── */}
              <div className="trust-strip my-6">
                <span className="trust-badge">
                  <span className="trust-icon"><FiCpu /></span>
                  Specialized AI
                </span>

                <span className="trust-divider" />
                <span className="trust-badge">
                  <span className="trust-icon"><FiCheckCircle /></span>
                  Pay per use
                </span>

                <span className="trust-divider" />
                <span className="trust-badge">
                  <span className="trust-icon"><FiShield /></span>
                  x402 payments
                </span>

                <span className="trust-divider" />
                <span className="trust-badge">
                  <span className="trust-icon"><FiLink /></span>
                  Algorand settlement
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 02: WHAT PRISM DOES (REFINED PLATFORM OVERVIEW) ── */}
        {viewState === 'landing' && (
          <section id="what-prism-does" className="lp-section w-full py-20 md:py-28 relative overflow-hidden bg-transparent">

            {/* PRISM Iridescent Crystal (Smaller & pushed further right) */}
            <div className="absolute top-1/2 -translate-y-1/2 -right-28 sm:-right-36 md:-right-48 lg:-right-56 pointer-events-none select-none z-0">
              <div className="absolute inset-0 bg-indigo-600/15 blur-3xl rounded-full scale-110 pointer-events-none" />
              <img
                src="/prism.png"
                alt="PRISM Iridescent Crystal"
                className="w-[320px] sm:w-[420px] md:w-[500px] lg:w-[580px] xl:w-[640px] h-auto object-contain opacity-50 transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">

                {/* LEFT: Text Description */}
                <div className="lg:col-span-5 text-left flex flex-col gap-6 justify-center">
                  <div>
                    <p className="lp-eyebrow text-left mb-3">PLATFORM OVERVIEW</p>
                    <h2 className="lp-section-heading text-left uppercase leading-tight">
                      ONE PLATFORM.<br />
                      <span className="lp-hero-gradient">AI FOR THE WORK YOU ACTUALLY DO.</span>
                    </h2>
                  </div>

                  <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed border-l-2 border-indigo-500/40 pl-4 py-1 max-w-md">
                    Send the work to PRISM.<br />
                    It understands, optimizes, routes, and executes.
                  </p>
                </div>

                {/* MIDDLE: Vertical Flowchart Stack */}
                <div className="lg:col-span-4 flex justify-center items-center z-10 py-4 lg:py-0">
                  <div className="flex flex-col items-center text-center gap-2 w-full max-w-[290px]">

                    {/* Node 01: YOUR TASK */}
                    <div className="w-full bg-slate-900/75 backdrop-blur-xl border border-blue-500/30 border-t-blue-400/40 p-4 rounded-2xl shadow-xl hover:border-blue-400/60 transition-all duration-300 text-center flex flex-col items-center">
                      <span className="text-[10px] font-mono font-extrabold text-blue-400 uppercase tracking-widest block text-center">01</span>
                      <h3 className="cap-title text-sm sm:text-base font-extrabold text-slate-100 uppercase mt-1 mb-0.5 text-center">YOUR TASK</h3>
                      <p className="cap-body text-xs sm:text-sm text-slate-200 leading-relaxed mt-0.5 text-center mb-0">Send your request or business document to PRISM.</p>
                    </div>

                    {/* Connecting Line 1 */}
                    <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500/60 to-indigo-500/60 shadow-[0_0_8px_rgba(99,102,241,0.5)] my-0.5 relative flex items-center justify-center">
                      <span className="text-[10px] text-indigo-400 -translate-y-0.5 select-none">↓</span>
                    </div>

                    {/* Node 02: PRISM */}
                    <div className="w-full bg-slate-900/75 backdrop-blur-xl border border-indigo-500/35 border-t-indigo-400/45 p-4 rounded-2xl shadow-xl hover:border-indigo-400/60 transition-all duration-300 text-center flex flex-col items-center">
                      <span className="text-[10px] font-mono font-extrabold text-indigo-300 uppercase tracking-widest block text-center">02</span>
                      <h3 className="cap-title text-sm sm:text-base font-extrabold text-slate-100 uppercase mt-1 mb-0.5 text-center">PRISM</h3>
                      <p className="cap-body text-xs sm:text-sm text-slate-200 leading-relaxed mt-0.5 text-center mb-0">Understands intent, structures context, and optimizes tokens.</p>
                    </div>

                    {/* Connecting Line 2 */}
                    <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500/60 to-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.5)] my-0.5 relative flex items-center justify-center">
                      <span className="text-[10px] text-purple-400 -translate-y-0.5 select-none">↓</span>
                    </div>

                    {/* Node 03: RIGHT AI CAPABILITY */}
                    <div className="w-full bg-slate-900/75 backdrop-blur-xl border border-purple-500/35 border-t-purple-400/45 p-4 rounded-2xl shadow-xl hover:border-purple-400/60 transition-all duration-300 text-center flex flex-col items-center">
                      <span className="text-[10px] font-mono font-extrabold text-purple-400 uppercase tracking-widest block text-center">03</span>
                      <h3 className="cap-title text-sm sm:text-base font-extrabold text-slate-100 uppercase mt-1 mb-0.5 text-center">RIGHT AI CAPABILITY</h3>
                      <p className="cap-body text-xs sm:text-sm text-slate-200 leading-relaxed mt-0.5 text-center mb-0">Routes execution to the optimal specialized AI tier.</p>
                    </div>

                    {/* Connecting Line 3 */}
                    <div className="w-0.5 h-6 bg-gradient-to-b from-purple-500/60 to-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.5)] my-0.5 relative flex items-center justify-center">
                      <span className="text-[10px] text-emerald-400 -translate-y-0.5 select-none">↓</span>
                    </div>

                    {/* Node 04: RESULT */}
                    <div className="w-full bg-slate-900/75 backdrop-blur-xl border border-emerald-500/35 border-t-emerald-400/45 p-4 rounded-2xl shadow-xl hover:border-emerald-400/60 transition-all duration-300 text-center flex flex-col items-center">
                      <span className="text-[10px] font-mono font-extrabold text-emerald-400 uppercase tracking-widest block text-center">04</span>
                      <h3 className="cap-title text-sm sm:text-base font-extrabold text-slate-100 uppercase mt-1 mb-0.5 text-center">RESULT</h3>
                      <p className="cap-body text-xs sm:text-sm text-slate-200 leading-relaxed mt-0.5 text-center mb-0">Structured, actionable output returned instantly.</p>
                    </div>

                  </div>
                </div>

                {/* RIGHT SPACER FOR PRISM CRYSTAL VISUAL */}
                <div className="hidden lg:block lg:col-span-3 pointer-events-none" />

              </div>
            </div>
          </section>
        )}

        {/* ── SECTION 03: CAPABILITIES ── */}
        {viewState === 'landing' && (
          <section id="capabilities" className="lp-section w-full relative overflow-hidden bg-transparent">
            {/* Top-Left Image Graphic (shifted even further top and left) */}
            <div className="absolute -top-16 -left-16 sm:-top-24 sm:-left-24 pointer-events-none select-none z-0">
              <img
                src="/capabilitiestop.png"
                alt="Capabilities Top Graphic"
                className="w-auto h-auto max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg object-contain opacity-50 -translate-x-8 -translate-y-8"
              />
            </div>

            <div className="lp-section-inner relative z-10">
              <p className="lp-eyebrow">Capabilities</p>
              <h2 className="lp-section-heading uppercase">AI FOR THE WORK THAT MATTERS.</h2>
              <p className="lp-section-sub mb-10 md:mb-14">
                Specialized capabilities for real business workflows.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left mt-10 md:mt-14 mb-8">
                {/* Card 1: Code Review */}
                <div className="cap-card cap-card--indigo">
                  <div className="flex items-center justify-between mb-4">
                    <div className="cap-icon-wrap cap-icon-wrap--indigo mb-0">
                      <FiCode />
                    </div>
                    <span className="text-[10px] font-extrabold font-mono text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">Engineering</span>
                  </div>
                  <h3 className="cap-title">CODE REVIEW</h3>
                  <p className="cap-body">
                    Analyze code, identify issues, and provide actionable feedback.
                  </p>
                  <div className="mt-auto border-t border-slate-800/60 pt-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Scope:</p>
                    <ul className="cap-features">
                      <li><FiCheckCircle className="cap-feat-icon" /> Static &amp; dynamic code analysis</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Vulnerability &amp; bug detection</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Actionable refactoring guidance</li>
                    </ul>
                  </div>
                </div>

                {/* Card 2: Resume Screening */}
                <div className="cap-card cap-card--blue">
                  <div className="flex items-center justify-between mb-4">
                    <div className="cap-icon-wrap cap-icon-wrap--blue mb-0">
                      <FiUserCheck />
                    </div>
                    <span className="text-[10px] font-extrabold font-mono text-blue-400 uppercase bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">HR</span>
                  </div>
                  <h3 className="cap-title">RESUME SCREENING</h3>
                  <p className="cap-body">
                    Evaluate candidates against job requirements and surface relevant hiring insights.
                  </p>
                  <div className="mt-auto border-t border-slate-800/60 pt-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Scope:</p>
                    <ul className="cap-features">
                      <li><FiCheckCircle className="cap-feat-icon" /> Job description alignment</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Candidate skill extraction</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Objective match scoring</li>
                    </ul>
                  </div>
                </div>

                {/* Card 3: SEO Audit */}
                <div className="cap-card cap-card--purple">
                  <div className="flex items-center justify-between mb-4">
                    <div className="cap-icon-wrap cap-icon-wrap--purple mb-0">
                      <FiGlobe />
                    </div>
                    <span className="text-[10px] font-extrabold font-mono text-purple-400 uppercase bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">Marketing</span>
                  </div>
                  <h3 className="cap-title">SEO AUDIT</h3>
                  <p className="cap-body">
                    Evaluate websites and identify actionable opportunities to improve search performance.
                  </p>
                  <div className="mt-auto border-t border-slate-800/60 pt-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Scope:</p>
                    <ul className="cap-features">
                      <li><FiCheckCircle className="cap-feat-icon" /> On-page structure &amp; meta audit</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Issue severity breakdown</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Actionable search optimization</li>
                    </ul>
                  </div>
                </div>

                {/* Card 4: Invoice Extraction */}
                <div className="cap-card cap-card--blue">
                  <div className="flex items-center justify-between mb-4">
                    <div className="cap-icon-wrap cap-icon-wrap--blue mb-0">
                      <FiBarChart2 />
                    </div>
                    <span className="text-[10px] font-extrabold font-mono text-blue-400 uppercase bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">Finance</span>
                  </div>
                  <h3 className="cap-title">INVOICE EXTRACTION</h3>
                  <p className="cap-body">
                    Turn invoices and documents into structured, usable data.
                  </p>
                  <div className="mt-auto border-t border-slate-800/60 pt-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Scope:</p>
                    <ul className="cap-features">
                      <li><FiCheckCircle className="cap-feat-icon" /> Line-item &amp; metadata parsing</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Structured JSON conversion</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Automated ledger readiness</li>
                    </ul>
                  </div>
                </div>

                {/* Card 5: Contract Analysis */}
                <div className="cap-card cap-card--purple">
                  <div className="flex items-center justify-between mb-4">
                    <div className="cap-icon-wrap cap-icon-wrap--purple mb-0">
                      <FiLock />
                    </div>
                    <span className="text-[10px] font-extrabold font-mono text-purple-400 uppercase bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">Legal</span>
                  </div>
                  <h3 className="cap-title">CONTRACT ANALYSIS</h3>
                  <p className="cap-body">
                    Surface important clauses, risks, and mitigation insights from contracts.
                  </p>
                  <div className="mt-auto border-t border-slate-800/60 pt-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Scope:</p>
                    <ul className="cap-features">
                      <li><FiCheckCircle className="cap-feat-icon" /> Critical clause detection</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Risk severity classification</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Mitigation recommendations</li>
                    </ul>
                  </div>
                </div>

                {/* Card 6: Media Intelligence */}
                <div className="cap-card cap-card--indigo">
                  <div className="flex items-center justify-between mb-4">
                    <div className="cap-icon-wrap cap-icon-wrap--indigo mb-0">
                      <FiTv />
                    </div>
                    <span className="text-[10px] font-extrabold font-mono text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">Media / News</span>
                  </div>
                  <h3 className="cap-title">MEDIA INTELLIGENCE</h3>
                  <p className="cap-body">
                    Turn information from articles and sources into structured, verifiable intelligence.
                  </p>
                  <div className="mt-auto border-t border-slate-800/60 pt-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Includes:</p>
                    <ul className="cap-features">
                      <li><FiCheckCircle className="cap-feat-icon" /> Claim Extract</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Claim Verify</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> Source Compare</li>
                      <li><FiCheckCircle className="cap-feat-icon" /> News Research</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── SECTION 04: THE PRISM DIFFERENCE ── */}
        {viewState === 'landing' && (
          <section id="prism-difference" className="lp-section w-full relative overflow-hidden bg-transparent">
            {/* Background Graphic on Right Side (shifted down and left) */}
            <div className="absolute top-[52%] -translate-y-1/3 -right-4 sm:-right-8 md:-right-12 lg:-right-16 pointer-events-none select-none z-0">
              <img
                src="/intelligencelayer.png"
                alt="Intelligence Layer Visual"
                className="w-[320px] sm:w-[420px] md:w-[520px] lg:w-[600px] h-auto object-contain opacity-50 translate-y-6"
              />
            </div>

            <div className="lp-section-inner relative z-10">
              <p className="lp-eyebrow">Intelligence Layer</p>
              <h2 className="lp-section-heading uppercase">PRISM THINKS BEFORE IT RUNS.</h2>
              <p className="lp-section-sub mb-10 md:mb-14">
                Every request passes through an intelligence layer that helps understand the task, optimize context, and select the appropriate capability before execution.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left mt-10 md:mt-14 mb-8">
                <div className="cap-card !p-4 sm:!p-5 gap-1.5 h-auto">
                  <h3 className="cap-title text-sm font-extrabold text-indigo-400 mb-1">PROMPT TUTOR</h3>
                  <p className="cap-body !flex-none text-xs text-slate-200 leading-relaxed !mb-0">Understand the task and intent.</p>
                </div>
                <div className="cap-card !p-4 sm:!p-5 gap-1.5 h-auto">
                  <h3 className="cap-title text-sm font-extrabold text-blue-400 mb-1">DATA MAP</h3>
                  <p className="cap-body !flex-none text-xs text-slate-200 leading-relaxed !mb-0">Structure the relevant context.</p>
                </div>
                <div className="cap-card !p-4 sm:!p-5 gap-1.5 h-auto">
                  <h3 className="cap-title text-sm font-extrabold text-purple-400 mb-1">SEMANTIC CACHE</h3>
                  <p className="cap-body !flex-none text-xs text-slate-200 leading-relaxed !mb-0">Reuse relevant context when applicable.</p>
                </div>
                <div className="cap-card !p-4 sm:!p-5 gap-1.5 h-auto">
                  <h3 className="cap-title text-sm font-extrabold text-emerald-400 mb-1">PROMPT OPTIMIZER</h3>
                  <p className="cap-body !flex-none text-xs text-slate-200 leading-relaxed !mb-0">Reduce unnecessary processing and measure token savings.</p>
                </div>
                <div className="cap-card !p-4 sm:!p-5 gap-1.5 h-auto">
                  <h3 className="cap-title text-sm font-extrabold text-amber-400 mb-1">AI ROUTER</h3>
                  <p className="cap-body !flex-none text-xs text-slate-200 leading-relaxed !mb-0">Select the appropriate capability and execution tier.</p>
                </div>
              </div>

              <div className="mt-6 !py-2.5 !px-6 cap-card flex flex-col items-center justify-center gap-1 max-w-xl mx-auto text-center">
                <p className="cap-title text-xs sm:text-sm font-extrabold text-indigo-300 tracking-wider uppercase mb-0">
                  UNDERSTAND &nbsp;→&nbsp; OPTIMIZE &nbsp;→&nbsp; ROUTE &nbsp;→&nbsp; EXECUTE
                </p>
                <span className="cap-body !flex-none text-xs sm:text-sm text-slate-200 font-semibold !mb-0">Specialized AI, intelligently orchestrated.</span>
              </div>
            </div>
          </section>
        )}

        {/* ── SECTION 05: PAY-PER-USE ── */}
        {viewState === 'landing' && (
          <section id="pricing" className="lp-section lp-section--alt w-full py-12 md:py-16 overflow-hidden relative">
            <div className="lp-section-inner max-w-7xl mx-auto px-6 md:px-12 relative z-10">
              <div className="text-center">
                <p className="lp-eyebrow">Pay-Per-Use Access</p>
                <h2 className="lp-section-heading uppercase">AI WITHOUT THE SUBSCRIPTION OVERHEAD.</h2>
                <p className="lp-section-sub mb-12 md:mb-16 max-w-2xl mx-auto">
                  No seats. No unused bundles. Pay when the capability runs.
                </p>
              </div>

              {/* 2 PRICING CARDS CENTERED */}
              <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 text-left mt-6">
                {/* Traditional AI Tools Card */}
                <div className="pricing-card">
                  <h3 className="cap-title text-base font-extrabold text-slate-100 uppercase mb-2">TRADITIONAL AI TOOLS</h3>
                  <div className="my-4 py-4 border-y border-slate-800/80 flex flex-col items-center gap-2">
                    <span className="cap-body text-sm font-bold text-slate-200 mb-0">Subscription</span>
                    <span className="text-slate-500 text-xs">↓</span>
                    <span className="cap-body text-sm font-bold text-slate-200 mb-0">Fixed access</span>
                    <span className="text-slate-500 text-xs">↓</span>
                    <span className="cap-body text-sm font-bold text-rose-400 mb-0">Pay even when unused</span>
                  </div>
                  <ul className="pricing-features">
                    <li className="pricing-feat pricing-feat--no text-sm font-semibold"><span>✕</span> Mandatory per-seat subscriptions</li>
                    <li className="pricing-feat pricing-feat--no text-sm font-semibold"><span>✕</span> Unused bundle waste</li>
                    <li className="pricing-feat pricing-feat--no text-sm font-semibold"><span>✕</span> Fixed monthly commitments</li>
                  </ul>
                </div>

                {/* PRISM Card */}
                <div className="pricing-card pricing-card--highlight">
                  <div className="pricing-badge">PRISM</div>
                  <h3 className="cap-title text-base font-extrabold text-slate-100 uppercase mb-2">PAY-PER-USE AI</h3>
                  <div className="my-4 py-4 border-y border-slate-800/80 flex flex-col items-center gap-2">
                    <span className="cap-body text-sm font-bold text-indigo-300 mb-0">Choose a task</span>
                    <span className="text-indigo-400 text-xs">↓</span>
                    <span className="cap-body text-sm font-bold text-indigo-300 mb-0">Run a capability</span>
                    <span className="text-indigo-400 text-xs">↓</span>
                    <span className="cap-body text-sm font-bold text-emerald-400 mb-0">Pay per use</span>
                  </div>
                  <ul className="pricing-features">
                    <li className="pricing-feat pricing-feat--yes text-sm font-semibold"><FiCheckCircle /> Fast &amp; Accurate execution tiers where available</li>
                    <li className="pricing-feat pricing-feat--yes text-sm font-semibold"><FiCheckCircle /> Optimization savings may apply when eligible</li>
                    <li className="pricing-feat pricing-feat--yes text-sm font-semibold"><FiCheckCircle /> x402 instant settlement on Algorand</li>
                  </ul>
                  <button
                    className="btn btn-primary w-full mt-6 rounded-xl font-bold text-sm"
                    onClick={() => { navigate('/signup') }}
                  >
                    View Pricing &amp; Get Started →
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── SECTION 08: TRACTION / METRICS ── */}
        {viewState === 'landing' && (
          <section id="traction" className="lp-section w-full py-10 md:py-14 overflow-hidden relative">
            {/* ABSOLUTE BACKGROUND 3D PRISM VISUAL (LOWERED SLIGHTLY) */}
            <div className="absolute -left-12 sm:-left-24 md:-left-32 lg:-left-40 top-1/2 -translate-y-1/3 mt-2 md:mt-4 z-0 pointer-events-none select-none">
              <img
                src="/metrics.png"
                alt="PRISM Metrics Background Visual"
                className="w-[440px] sm:w-[560px] md:w-[680px] lg:w-[760px] max-w-none h-auto object-contain mix-blend-multiply opacity-50 transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="lp-section-inner max-w-7xl mx-auto px-6 md:px-12 relative z-10">

              {/* SECTION HEADER */}
              <div className="text-center mb-10 md:mb-14 max-w-3xl lg:ml-auto lg:translate-x-36 xl:translate-x-48">
                <p className="lp-eyebrow text-center">Verified Metrics</p>
                <h2 className="lp-section-heading text-center uppercase">ALREADY RUNNING IN THE REAL WORLD.</h2>
                <p className="lp-section-sub text-center max-w-2xl mx-auto mb-10 md:mb-14">
                  PRISM is already being used, paid for, and settled on-chain.
                </p>
              </div>

              {/* CONTENT CONTAINER WITH CARDS ANCHORED TO THE RIGHT */}
              <div className="flex flex-col lg:flex-row items-center justify-end gap-8 relative">

                {/* UNIFORM APPLE GLASS UI METRIC GRID (COMPACT & RIGHT-ALIGNED) */}
                <div className="w-full lg:w-[80%] xl:w-[82%] lg:ml-auto lg:translate-x-40 xl:translate-x-56 grid grid-cols-2 sm:grid-cols-3 gap-5 md:gap-6 lg:gap-7 z-20">

                  {/* Card 1 */}
                  <div className="cap-card !py-5 !px-6 md:!py-6 md:!px-8 min-h-[120px] md:min-h-[140px] h-full flex flex-col items-center justify-center text-center group relative overflow-hidden">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform">
                      $950+
                    </span>
                    <span className="cap-body !flex-none text-[11px] sm:text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-200 mt-2 whitespace-nowrap !mb-0">
                      Settled Volume
                    </span>
                  </div>

                  {/* Card 2 */}
                  <div className="cap-card !py-5 !px-6 md:!py-6 md:!px-8 min-h-[120px] md:min-h-[140px] h-full flex flex-col items-center justify-center text-center group relative overflow-hidden">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform">
                      11.9K
                    </span>
                    <span className="cap-body !flex-none text-[11px] sm:text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-200 mt-2 whitespace-nowrap !mb-0">
                      Settlements
                    </span>
                  </div>

                  {/* Card 3 */}
                  <div className="cap-card !py-5 !px-6 md:!py-6 md:!px-8 min-h-[120px] md:min-h-[140px] h-full flex flex-col items-center justify-center text-center group relative overflow-hidden">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform">
                      99.9%
                    </span>
                    <span className="cap-body !flex-none text-[11px] sm:text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-200 mt-2 whitespace-nowrap !mb-0">
                      Success Rate
                    </span>
                  </div>

                  {/* Card 4 */}
                  <div className="cap-card !py-5 !px-6 md:!py-6 md:!px-8 min-h-[120px] md:min-h-[140px] h-full flex flex-col items-center justify-center text-center group relative overflow-hidden">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform">
                      0.2 sec
                    </span>
                    <span className="cap-body !flex-none text-[11px] sm:text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-200 mt-2 whitespace-nowrap !mb-0">
                      Avg. Settlement
                    </span>
                  </div>

                  {/* Card 5 */}
                  <div className="cap-card !py-5 !px-6 md:!py-6 md:!px-8 min-h-[120px] md:min-h-[140px] h-full flex flex-col items-center justify-center text-center group relative overflow-hidden">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform">
                      16
                    </span>
                    <span className="cap-body !flex-none text-[11px] sm:text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-200 mt-2 whitespace-nowrap !mb-0">
                      Organizations
                    </span>
                  </div>

                  {/* Card 6 */}
                  <div className="cap-card !py-5 !px-6 md:!py-6 md:!px-8 min-h-[120px] md:min-h-[140px] h-full flex flex-col items-center justify-center text-center group relative overflow-hidden">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform">
                      35
                    </span>
                    <span className="cap-body !flex-none text-[11px] sm:text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-200 mt-2 whitespace-nowrap !mb-0">
                      Active Users
                    </span>
                  </div>

                </div>

              </div>
            </div>
          </section>
        )}

        {/* ── SECTION 09: GET IN TOUCH ── */}
        {viewState === 'landing' && (
          <section id="get-in-touch" className="lp-section relative w-full min-h-screen py-16 md:py-24 overflow-hidden flex flex-col justify-center items-center bg-slate-950/40 backdrop-blur-xs border-t border-white/10">
            {/* Background Glow effects */}
            <div className="absolute inset-0 pointer-events-none select-none z-0">
              <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-blue-600/15 via-indigo-600/20 to-purple-600/15 blur-[140px]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px]" />
            </div>

            <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full flex flex-col items-center">
              
              {/* CENTERED SECTION TITLE & SUBTITLE */}
              <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3 text-center">
                  Get in <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Touch</span>
                </h2>
                <p className="text-sm md:text-base text-slate-300 font-medium text-center">
                  Have a collaboration opportunity, or question? Send us a message and we'll get right back to you.
                </p>
              </div>

              {/* SIDE-BY-SIDE: BOX ON LEFT, IMAGE ON RIGHT TOUCHING SCREEN RIGHT EDGE */}
              <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0">
                
                {/* LEFT: FORM BOX */}
                <div className="w-full lg:w-1/2 max-w-xl shrink-0 text-left py-2 z-20">
                  <form
                    onSubmit={handleContactSubmit}
                    noValidate
                    className="bg-slate-900/15 backdrop-blur-2xl border border-white/10 border-t-white/20 p-6 md:p-8 rounded-3xl shadow-2xl shadow-black/80 flex flex-col gap-4 relative text-left items-start"
                  >
                    {contactStatus === 'success' ? (
                      <div className="py-8 flex flex-col items-center text-center gap-3 animate-fade-in w-full" role="status">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl shadow-lg shadow-emerald-500/10">
                          <FiCheckCircle />
                        </div>
                        <h4 className="text-xl font-bold text-white">Message sent successfully! ✓</h4>
                        <p className="text-xs md:text-sm text-slate-300 max-w-xs leading-relaxed">
                          Thanks for reaching out. We’ll get back to you soon.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetContactForm}
                          className="btn btn-outline btn-sm rounded-full px-6 text-xs font-semibold mt-3 hover:bg-white/10 transition-all text-white"
                        >
                          Send another message
                        </button>
                      </div>
                    ) : (
                      <>
                        {contactStatus === 'error' && (
                          <div role="alert" className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fade-in w-full text-left">
                            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                            <span>Something went wrong. Please try again.</span>
                          </div>
                        )}

                        {/* Name Field */}
                        <div className="flex flex-col gap-1.5 text-left items-start w-full">
                          <label htmlFor="from_name" className="text-sm md:text-base font-extrabold text-slate-100 text-left">Name</label>
                          <input
                            id="from_name"
                            name="from_name"
                            type="text"
                            placeholder="Your Name"
                            value={contactForm.name}
                            disabled={isSubmitting}
                            aria-invalid={!!formErrors.name}
                            aria-describedby={formErrors.name ? "name-error" : undefined}
                            onChange={(e) => {
                              setContactForm({ ...contactForm, name: e.target.value })
                              if (formErrors.name) setFormErrors({ ...formErrors, name: undefined })
                            }}
                            className={`w-full bg-slate-950/70 border ${formErrors.name ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500/80'} focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-4 py-3.5 text-base text-white placeholder-slate-400 outline-none transition-all disabled:opacity-60 text-left placeholder:text-left`}
                          />
                          {formErrors.name && (
                            <span id="name-error" className="text-xs sm:text-sm text-rose-400 font-medium text-left">{formErrors.name}</span>
                          )}
                        </div>

                        {/* Email Field */}
                        <div className="flex flex-col gap-1.5 text-left items-start w-full">
                          <label htmlFor="from_email" className="text-sm md:text-base font-extrabold text-slate-100 text-left">Email</label>
                          <input
                            id="from_email"
                            name="from_email"
                            type="email"
                            placeholder="your.email@company.com"
                            value={contactForm.email}
                            disabled={isSubmitting}
                            aria-invalid={!!formErrors.email}
                            aria-describedby={formErrors.email ? "email-error" : undefined}
                            onChange={(e) => {
                              setContactForm({ ...contactForm, email: e.target.value })
                              if (formErrors.email) setFormErrors({ ...formErrors, email: undefined })
                            }}
                            className={`w-full bg-slate-950/70 border ${formErrors.email ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500/80'} focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-4 py-3.5 text-base text-white placeholder-slate-400 outline-none transition-all disabled:opacity-60 text-left placeholder:text-left`}
                          />
                          {formErrors.email && (
                            <span id="email-error" className="text-xs sm:text-sm text-rose-400 font-medium text-left">{formErrors.email}</span>
                          )}
                        </div>

                        {/* Message Field */}
                        <div className="flex flex-col gap-1.5 text-left items-start w-full">
                          <label htmlFor="message" className="text-sm md:text-base font-extrabold text-slate-100 text-left">Message</label>
                          <textarea
                            id="message"
                            name="message"
                            rows={4}
                            placeholder="Tell us how we can help..."
                            value={contactForm.message}
                            disabled={isSubmitting}
                            aria-invalid={!!formErrors.message}
                            aria-describedby={formErrors.message ? "message-error" : undefined}
                            onChange={(e) => {
                              setContactForm({ ...contactForm, message: e.target.value })
                              if (formErrors.message) setFormErrors({ ...formErrors, message: undefined })
                            }}
                            className={`w-full bg-slate-950/70 border ${formErrors.message ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500/80'} focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-4 py-3.5 text-base text-white placeholder-slate-400 outline-none transition-all resize-none disabled:opacity-60 text-left placeholder:text-left`}
                          />
                          {formErrors.message && (
                            <span id="message-error" className="text-xs sm:text-sm text-rose-400 font-medium text-left">{formErrors.message}</span>
                          )}
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="btn btn-primary w-full rounded-xl py-4 mt-2 font-extrabold text-base shadow-xl shadow-indigo-500/25 border border-indigo-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none text-center"
                        >
                          <span>{isSubmitting ? 'Sending...' : 'Send Message →'}</span>
                        </button>
                      </>
                    )}
                  </form>
                </div>

                {/* RIGHT: ARTWORK IMAGE (MOVED RIGHT) */}
                <div className="w-full lg:w-[45%] xl:w-[48%] 2xl:w-[50%] h-[280px] md:h-[350px] lg:h-[400px] 2xl:h-[450px] relative flex items-center justify-center lg:justify-end z-10 pointer-events-none select-none scale-90 sm:scale-95 lg:scale-105 xl:scale-115 2xl:scale-125 origin-right translate-x-2 lg:translate-x-10 xl:translate-x-16">
                  <img
                    src="/get-in-touch.png"
                    alt="Get in Touch PRISM Visual"
                    className="w-full h-full object-contain lg:object-right opacity-50"
                  />
                </div>

              </div>

            </div>
          </section>
        )}

        {/* AUTH VIEW (LOGIN / SIGNUP) */}
        {viewState === 'auth' && (
          <div className="auth-screen relative overflow-hidden">

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

            {/* Bottom Graphic Visual */}
            <div className="absolute -bottom-12 -right-12 sm:-bottom-20 sm:-right-20 pointer-events-none select-none z-0">
              <img
                src="/metrics.png"
                alt="PRISM Metrics Visual"
                className="w-auto h-auto max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg object-contain translate-x-6 translate-y-6"
              />
            </div>

            {/* Centered card */}
            <div className="w-full max-w-md liquid-glass p-8 animate-scale-up relative z-10">

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

      {/* ── MINIMAL TRANSPARENT FOOTER WITH OVERSIZED WORDMARK (landing only) ── */}
      {viewState === 'landing' && (
        <footer className="w-full bg-transparent text-white pt-6 md:pt-10 pb-6 relative z-20 overflow-hidden select-none border-t border-white/10">
          {/* OVERSIZED PRISM WORDMARK (TOUCHES THE BOTTOM GLASS BAR) */}
          <div className="w-full px-4 text-center mt-2 md:mt-4 -mb-3 sm:-mb-5 md:-mb-7 relative z-10">
            <h1 className="text-[13vw] sm:text-[15vw] md:text-[16vw] font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/25 via-white/12 to-indigo-400/10 select-none pointer-events-none">
              PRISM
            </h1>
          </div>

          {/* Bottom Glass Bar Container */}
          <div className="w-full max-w-6xl mx-auto px-4 md:px-8 relative z-20">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 border-t-white/20 rounded-2xl sm:rounded-full px-6 md:px-8 py-3.5 shadow-2xl shadow-black/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300 font-light tracking-wide">
              <span className="font-light text-slate-300/90">© {new Date().getFullYear()} PRISM. All rights reserved.</span>

              {/* Social Icons (X & Instagram only) */}
              <div className="flex items-center gap-2.5">
                <a
                  href="https://x.com/prismx402"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="X"
                  className="w-7 h-7 rounded-full border border-white/10 bg-slate-950/60 flex items-center justify-center text-slate-300 hover:text-white hover:border-indigo-400/50 hover:bg-indigo-950/40 transition-all shadow-sm"
                >
                  <FiTwitter className="text-[11px]" />
                </a>
                <a
                  href="https://www.instagram.com/prism.x402/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram"
                  className="w-7 h-7 rounded-full border border-white/10 bg-slate-950/60 flex items-center justify-center text-slate-300 hover:text-white hover:border-indigo-400/50 hover:bg-indigo-950/40 transition-all shadow-sm"
                >
                  <FiInstagram className="text-[11px]" />
                </a>
              </div>

              <span className="text-slate-300/80 font-light uppercase text-[11px] tracking-wider">
                Powered by <span className="text-indigo-300 font-normal">Algorand</span>
              </span>
            </div>
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
