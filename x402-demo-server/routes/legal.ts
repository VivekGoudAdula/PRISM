import { Hono } from 'hono';
import {
  CURRENT_LEGAL_VERSIONS,
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
} from '../legal.config';

const legalRouter = new Hono();

/**
 * GET /api/legal/config
 * Returns current authoritative legal versions and revision metadata.
 */
legalRouter.get('/config', (c) => {
  return c.json({
    versions: CURRENT_LEGAL_VERSIONS,
    terms: {
      title: TERMS_OF_SERVICE.title,
      version: TERMS_OF_SERVICE.version,
      effectiveDate: TERMS_OF_SERVICE.effectiveDate,
      lastUpdated: TERMS_OF_SERVICE.lastUpdated,
      sectionCount: TERMS_OF_SERVICE.sections.length,
    },
    privacy: {
      title: PRIVACY_POLICY.title,
      version: PRIVACY_POLICY.version,
      effectiveDate: PRIVACY_POLICY.effectiveDate,
      lastUpdated: PRIVACY_POLICY.lastUpdated,
      sectionCount: PRIVACY_POLICY.sections.length,
    },
  });
});

/**
 * GET /api/legal/documents
 * Returns both full legal documents.
 */
legalRouter.get('/documents', (c) => {
  return c.json({
    versions: CURRENT_LEGAL_VERSIONS,
    termsOfService: TERMS_OF_SERVICE,
    privacyPolicy: PRIVACY_POLICY,
  });
});

/**
 * GET /api/legal/terms
 * Returns complete Terms of Service document.
 */
legalRouter.get('/terms', (c) => {
  return c.json(TERMS_OF_SERVICE);
});

/**
 * GET /api/legal/privacy
 * Returns complete Privacy Policy document.
 */
legalRouter.get('/privacy', (c) => {
  return c.json(PRIVACY_POLICY);
});

export default legalRouter;
