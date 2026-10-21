import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiFileText, FiShield, FiExternalLink, FiCheckCircle } from 'react-icons/fi';
import { LegalDocument } from '../data/legalDocuments';

interface LegalDocumentViewProps {
  document: LegalDocument;
  otherDocumentPath: string;
  otherDocumentLabel: string;
}

/**
 * Accessible, responsive legal document viewer with section navigation,
 * table of contents, in-page search filtering, and PRISM liquid-glass aesthetics.
 */
export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({
  document,
  otherDocumentPath,
  otherDocumentLabel,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  // Track scroll position to highlight active section in TOC
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const section of document.sections) {
        const el = window.document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSectionId(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [document.sections]);

  const filteredSections = searchQuery.trim()
    ? document.sections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : document.sections;

  const scrollToSection = (id: string) => {
    const el = window.document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSectionId(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background Glow Accents */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-[500px] h-[300px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 transition-all cursor-pointer"
            aria-label="Return to PRISM Homepage"
          >
            <FiArrowLeft className="text-sm" />
            <span>Home</span>
          </button>

          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="PRISM Logo" className="h-7 w-auto object-contain" />
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Legal Center
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={otherDocumentPath}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-indigo-300 bg-slate-900/60 hover:bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-white/10 transition-all"
          >
            <span>{otherDocumentLabel}</span>
            <FiExternalLink className="text-[11px]" />
          </Link>
        </div>
      </header>

      {/* Main Document Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col lg:flex-row gap-8 relative z-10">
        {/* Left Sidebar: Table of Contents & Metadata (Desktop Sticky) */}
        <aside className="lg:w-80 shrink-0">
          <div className="sticky top-20 flex flex-col gap-5 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
            {/* Document Header Badge */}
            <div className="flex flex-col gap-1.5 border-b border-slate-800 pb-4">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                {document.id === 'terms' ? <FiFileText /> : <FiShield />}
                {document.badge}
              </span>
              <h1 className="text-lg font-extrabold text-white leading-tight">
                {document.title}
              </h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                <span>Version: <strong className="text-slate-200">{document.version}</strong></span>
                <span>•</span>
                <span>Effective: <strong className="text-slate-200">{document.effectiveDate}</strong></span>
              </div>
            </div>

            {/* In-Document Search Bar */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search clauses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                aria-label="Search within document"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Table of Contents List */}
            <div className="flex flex-col">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Table of Contents ({document.sections.length} Sections)
              </p>
              <nav className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto pr-1 text-xs">
                {document.sections.map((section, idx) => {
                  const isActive = activeSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`text-left px-2.5 py-1.5 rounded-md transition-all text-xs flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 font-semibold border-l-2 border-indigo-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="truncate">{section.title}</span>
                      {isActive && <FiCheckCircle className="shrink-0 text-indigo-400 text-[10px] ml-1" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Compliance Note */}
            <div className="border-t border-slate-800/80 pt-3 text-[11px] text-slate-500">
              <p>
                Drafted for PRISM platform operation under Indian DPDP Act, 2023 and applicable international digital standards.
              </p>
            </div>
          </div>
        </aside>

        {/* Right Section: Full Document Text */}
        <article className="flex-1 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl flex flex-col gap-8">
          {/* Header Metadata Banner */}
          <div className="bg-slate-950/60 border border-indigo-500/20 rounded-xl p-5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="badge badge-primary badge-sm font-bold uppercase tracking-wider text-[10px]">
                Official Policy
              </span>
              <span className="text-xs text-slate-400">
                Last Updated: <strong className="text-slate-200">{document.lastUpdated}</strong>
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-light mt-1">
              {document.introduction}
            </p>
          </div>

          {/* Search Result Count (if searching) */}
          {searchQuery && (
            <div className="text-xs text-indigo-400 bg-indigo-950/30 border border-indigo-900/50 p-2.5 rounded-lg flex items-center justify-between">
              <span>Showing {filteredSections.length} of {document.sections.length} clauses matching &quot;{searchQuery}&quot;</span>
              <button onClick={() => setSearchQuery('')} className="underline text-indigo-300 cursor-pointer">
                Clear search
              </button>
            </div>
          )}

          {/* Sections List */}
          <div className="flex flex-col gap-8 divide-y divide-slate-800/60">
            {filteredSections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="pt-6 first:pt-0 scroll-mt-24 flex flex-col gap-3 group"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {section.title}
                  </h2>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 hover:underline transition-opacity"
                    title="Direct anchor link"
                  >
                    #link
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-normal whitespace-pre-line space-y-2">
                  {section.content}
                </div>
              </section>
            ))}

            {filteredSections.length === 0 && (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <FiSearch className="text-2xl text-slate-500" />
                <p className="text-sm">No sections match your search query &quot;{searchQuery}&quot;.</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn btn-sm btn-ghost text-indigo-400 text-xs mt-2"
                >
                  Reset Search Filter
                </button>
              </div>
            )}
          </div>

          {/* Document Footer Navigation */}
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              <span>Need clarification? Contact our legal desk at </span>
              <a href="mailto:adulavivekgoud@gmail.com" className="text-indigo-400 hover:underline">
                adulavivekgoud@gmail.com
              </a>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer"
            >
              ↑ Back to top
            </button>
          </div>
        </article>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-white/10 bg-slate-950 px-4 md:px-8 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} PRISM Labs. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-slate-300 transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
