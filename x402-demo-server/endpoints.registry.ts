/**
 * Canonical Endpoint Registry for PRISM x402 Resources
 *
 * Enforces stable, deterministic resource URLs and identities for all PRISM endpoints.
 * This prevents the x402 facilitator from creating a new resource entry on every transaction.
 */

export const CANONICAL_BASE_URL =
  process.env.PUBLIC_URL ||
  process.env.CANONICAL_HOST ||
  process.env.BASE_URL ||
  'https://prism-99h2.onrender.com';

export interface CanonicalEndpoint {
  id: string;
  path: string;
  resourceUrl: string;
  description: string;
}

export const CANONICAL_ENDPOINTS: Record<string, CanonicalEndpoint> = {
  'code-review-fast': {
    id: 'code-review-fast',
    path: '/code-review-fast',
    resourceUrl: `${CANONICAL_BASE_URL}/code-review-fast`,
    description: 'Reviews a single code file for bugs, security issues, syntax errors, and code quality problems with fast LLM turnarounds.',
  },
  'code-review-accurate': {
    id: 'code-review-accurate',
    path: '/code-review-accurate',
    resourceUrl: `${CANONICAL_BASE_URL}/code-review-accurate`,
    description: 'Performs comprehensive senior-engineer code review and security auditing on a single code file using high-precision LLM reasoning.',
  },
  'resume-screen-fast': {
    id: 'resume-screen-fast',
    path: '/resume-screen-fast',
    resourceUrl: `${CANONICAL_BASE_URL}/resume-screen-fast`,
    description: 'Screens candidate resumes against job criteria using Llama 3 for fast initial candidate ranking.',
  },
  'resume-screen-accurate': {
    id: 'resume-screen-accurate',
    path: '/resume-screen-accurate',
    resourceUrl: `${CANONICAL_BASE_URL}/resume-screen-accurate`,
    description: 'Screens a batch of resumes against a target job description and returns ranked candidates with detailed match scores using high-precision LLM reasoning.',
  },
  'contract-analyze-fast': {
    id: 'contract-analyze-fast',
    path: '/contract-analyze-fast',
    resourceUrl: `${CANONICAL_BASE_URL}/contract-analyze-fast`,
    description: 'Extracts core legal clauses, liabilities, and obligations from contract documents with fast turnarounds.',
  },
  'contract-analyze-accurate': {
    id: 'contract-analyze-accurate',
    path: '/contract-analyze-accurate',
    resourceUrl: `${CANONICAL_BASE_URL}/contract-analyze-accurate`,
    description: 'Performs comprehensive legal contract risk analysis, clause extraction, and anomaly flagging with deep reasoning.',
  },
  'invoice-extract-fast': {
    id: 'invoice-extract-fast',
    path: '/invoice-extract-fast',
    resourceUrl: `${CANONICAL_BASE_URL}/invoice-extract-fast`,
    description: 'Extracts vendor details, invoice numbers, totals, and line items quickly from billing documents.',
  },
  'invoice-extract-accurate': {
    id: 'invoice-extract-accurate',
    path: '/invoice-extract-accurate',
    resourceUrl: `${CANONICAL_BASE_URL}/invoice-extract-accurate`,
    description: 'Performs high-precision structured data extraction of line items, taxes, vendor info, and totals from complex multi-page invoices.',
  },
  'seo-audit-fast': {
    id: 'seo-audit-fast',
    path: '/seo-audit-fast',
    resourceUrl: `${CANONICAL_BASE_URL}/seo-audit-fast`,
    description: 'Performs fast rule-based SEO audit checks on a webpage including metadata, headings, images, links, and readability.',
  },
  'seo-audit-accurate': {
    id: 'seo-audit-accurate',
    path: '/seo-audit-accurate',
    resourceUrl: `${CANONICAL_BASE_URL}/seo-audit-accurate`,
    description: 'Performs deep LLM-assisted SEO auditing analyzing readability, content depth, keyword relevance, and technical SEO structure.',
  },
  'execute-task': {
    id: 'execute-task',
    path: '/execute-task',
    resourceUrl: `${CANONICAL_BASE_URL}/execute-task`,
    description: 'Executes planned multi-file AI tasks with dynamic pricing and automated output verification.',
  },
  'run-task': {
    id: 'run-task',
    path: '/run-task',
    resourceUrl: `${CANONICAL_BASE_URL}/run-task`,
    description: 'Orchestrates document classification, endpoint selection, execution, and output verification with automated refund protection.',
  },
};

/**
 * Gets the canonical resource URL for a given path or route string.
 */
export function getCanonicalResourceUrl(routePath: string): string {
  const cleanPath = routePath.replace(/^(GET|POST|PUT|DELETE|OPTIONS)\s+/, '').split('?')[0];
  const endpointKey = cleanPath.replace(/^\//, '');
  if (CANONICAL_ENDPOINTS[endpointKey]) {
    return CANONICAL_ENDPOINTS[endpointKey].resourceUrl;
  }
  return `${CANONICAL_BASE_URL}${cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath}`;
}
