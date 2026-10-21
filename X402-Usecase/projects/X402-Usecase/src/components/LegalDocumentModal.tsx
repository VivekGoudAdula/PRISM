import React, { useState } from 'react';
import { FiX, FiExternalLink, FiFileText, FiShield, FiSearch } from 'react-icons/fi';
import { LegalDocument } from '../data/legalDocuments';

interface LegalDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: LegalDocument;
  onOpenDedicatedPage: (path: string) => void;
}

/**
 * Full, readable modal dialog for inspecting complete legal documents
 * without losing in-progress signup form state.
 *
 * NOTE: Opening or scrolling through this dialog DOES NOT constitute acceptance.
 * User must explicitly check the required checkboxes on the registration form.
 */
export const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({
  isOpen,
  onClose,
  document,
  onOpenDedicatedPage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const targetPath = document.id === 'terms' ? '/terms' : '/privacy';

  const filteredSections = searchQuery.trim()
    ? document.sections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : document.sections;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              {document.id === 'terms' ? <FiFileText className="text-lg" /> : <FiShield className="text-lg" />}
            </div>
            <div>
              <h3 id="legal-modal-title" className="text-base sm:text-lg font-extrabold text-white">
                {document.title}
              </h3>
              <p className="text-[11px] text-slate-400">
                Version {document.version} • Effective {document.effectiveDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenDedicatedPage(targetPath);
              }}
              className="btn btn-ghost btn-sm text-xs font-medium text-indigo-300 hover:text-white flex items-center gap-1.5 border border-indigo-500/20 rounded-lg px-3 py-1.5"
              title="Open full dedicated page"
            >
              <span>Full Page</span>
              <FiExternalLink className="text-[11px]" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close legal document dialog"
              className="btn btn-circle btn-ghost btn-sm text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <FiX className="text-lg" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="px-6 py-2.5 bg-indigo-950/40 border-b border-indigo-900/40 text-[11px] text-indigo-300 flex items-center justify-between">
          <span>
            ℹ️ Viewing or scrolling this document does not constitute acceptance. Affirmative selection of the checkbox on the signup form is required.
          </span>
          <div className="relative shrink-0 ml-4 hidden sm:block">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-md pl-7 pr-2 py-0.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36"
            />
          </div>
        </div>

        {/* Scrollable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-300 text-xs sm:text-sm leading-relaxed">
          {/* Preamble */}
          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-slate-300 text-xs leading-relaxed">
            {document.introduction}
          </div>

          {/* Sections */}
          <div className="space-y-6 divide-y divide-slate-800/60">
            {filteredSections.map((sec) => (
              <div key={sec.id} className="pt-5 first:pt-0">
                <h4 className="text-sm font-bold text-white mb-2">{sec.title}</h4>
                <p className="text-xs text-slate-300/90 leading-relaxed whitespace-pre-line">
                  {sec.content}
                </p>
              </div>
            ))}

            {filteredSections.length === 0 && (
              <div className="py-8 text-center text-slate-400">
                No clauses match &quot;{searchQuery}&quot;.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-4">
          <span className="text-[11px] text-slate-500">
            {document.sections.length} total sections • Last updated: {document.lastUpdated}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenDedicatedPage(targetPath);
              }}
              className="btn btn-outline btn-sm text-xs rounded-lg text-slate-300"
            >
              Open Dedicated Page
            </button>
            <button
              onClick={onClose}
              className="btn btn-primary btn-sm text-xs rounded-lg px-5 font-bold"
            >
              Close & Return to Signup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
