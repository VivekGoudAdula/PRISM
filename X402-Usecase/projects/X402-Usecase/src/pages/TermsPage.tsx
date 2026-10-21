import React, { useEffect } from 'react';
import { LegalDocumentView } from '../components/LegalDocumentView';
import { TERMS_OF_SERVICE } from '../data/legalDocuments';

/**
 * Public Terms of Service route (/terms)
 * Accessible without signing in.
 */
export const TermsPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms of Service | PRISM AI Orchestration';
  }, []);

  return (
    <LegalDocumentView
      document={TERMS_OF_SERVICE}
      otherDocumentPath="/privacy"
      otherDocumentLabel="View Privacy Policy"
    />
  );
};

export default TermsPage;
