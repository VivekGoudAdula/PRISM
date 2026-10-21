import React, { useEffect } from 'react';
import { LegalDocumentView } from '../components/LegalDocumentView';
import { PRIVACY_POLICY } from '../data/legalDocuments';

/**
 * Public Privacy Policy route (/privacy)
 * Accessible without signing in.
 */
export const PrivacyPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy | PRISM AI Orchestration';
  }, []);

  return (
    <LegalDocumentView
      document={PRIVACY_POLICY}
      otherDocumentPath="/terms"
      otherDocumentLabel="View Terms of Service"
    />
  );
};

export default PrivacyPage;
