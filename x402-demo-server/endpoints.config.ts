/**
 * X402 Hackathon Starter Kit - Endpoints Configuration
 *
 * This file defines all payment-protected endpoints for the x402 service.
 *
 * Key architecture:
 *  - Individual task endpoints (/resume-screen-*, /contract-analyze-*, etc.)
 *    use STATIC prices per call.
 *  - POST /execute-task uses a DYNAMIC price resolved from the plan stored
 *    in MongoDB (quantity × unitPrice + platformFee). The DynamicPrice
 *    function reads the planId from the query string, fetches the Task
 *    document, and returns the computed totalCost.
 */

import { ALGORAND_MAINNET_CAIP2, USDC_MAINNET_ASA_ID } from '@x402/avm';
import { declareDiscoveryExtension } from '@x402-avm/extensions';
import mongoose from 'mongoose';
import { Task } from './models/Task';
import { CANONICAL_ENDPOINTS } from './endpoints.registry';

export type DynamicPrice = (context: any) => Promise<string> | string;

// ─── Network Mode Configuration ─────────────────────────────────────────────

export const NETWORK_MODE = 'mainnet';

export const NETWORK_CONFIG = {
  caip2: ALGORAND_MAINNET_CAIP2,
  usdcAssetId: Number(USDC_MAINNET_ASA_ID), // 31566704
  name: 'MAINNET',
  algodServer: 'https://mainnet-api.algonode.cloud',
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StaticPaymentOption {
  scheme: 'exact';
  price: string;
  network: string;
  payTo: string;
  extra: { asset: number; tag: string };
}

export interface DynamicPaymentOption {
  scheme: 'exact';
  price: DynamicPrice;
  network: string;
  payTo: string;
  extra: { asset: number; tag: string };
}

export interface EndpointConfig {
  [key: string]: {
    resource?: string;
    accepts: Array<StaticPaymentOption | DynamicPaymentOption>;
    description: string;
    mimeType?: string;
    extensions?: Record<string, any>;
  };
}

// ─── Config factory ──────────────────────────────────────────────────────────

/**
 * Helper to dynamically resolve per-endpoint price based on planId if present in query, header, or body,
 * falling back to the base static price.
 */
export function createDynamicPriceResolver(fallbackPrice: string): DynamicPrice {
  return async (context: any) => {
    try {
      let planId: string | undefined;
      let fileIndex: number | undefined;

      if (context.adapter.getQueryParam) {
        const q = context.adapter.getQueryParam('planId') || context.adapter.getQueryParam('plan_id');
        if (typeof q === 'string') planId = q;
        else if (Array.isArray(q) && q.length > 0) planId = q[0];

        const fi = context.adapter.getQueryParam('fileIndex') || context.adapter.getQueryParam('file_index') || context.adapter.getQueryParam('itemIndex') || context.adapter.getQueryParam('item_index');
        if (fi !== undefined && fi !== null && !isNaN(Number(fi))) fileIndex = Number(fi);
      }

      if (!planId && context.adapter.getHeader) {
        planId = context.adapter.getHeader('x-plan-id') || context.adapter.getHeader('planid') || context.adapter.getHeader('plan_id');
      }

      if (fileIndex === undefined && context.adapter.getHeader) {
        const fi = context.adapter.getHeader('x-file-index') || context.adapter.getHeader('file-index') || context.adapter.getHeader('file_index');
        if (fi !== undefined && fi !== null && !isNaN(Number(fi))) fileIndex = Number(fi);
      }

      if (context.adapter.getBody) {
        const body: any = context.adapter.getBody();
        if (body && typeof body === 'object') {
          if (!planId) planId = body.planId || body.plan_id;
          if (fileIndex === undefined) {
            const fi = body.fileIndex ?? body.file_index ?? body.itemIndex ?? body.item_index;
            if (fi !== undefined && fi !== null && !isNaN(Number(fi))) fileIndex = Number(fi);
          }
        }
      }

      if (planId && mongoose.Types.ObjectId.isValid(planId)) {
        const task = await Task.findById(planId).select('unitPrice totalCost executionCost itemPrices plannerOutput').lean();
        if (task) {
          const itemPrices = (task as any).itemPrices || (task as any).plannerOutput?.itemPrices;
          if (Array.isArray(itemPrices) && fileIndex !== undefined && fileIndex >= 0 && fileIndex < itemPrices.length) {
            const itemPrice = itemPrices[fileIndex]?.finalPrice;
            if (typeof itemPrice === 'number' && itemPrice > 0) {
              return `$${itemPrice.toString()}`;
            }
          }
          if (typeof task.unitPrice === 'number' && task.unitPrice > 0) {
            return `$${task.unitPrice.toString()}`;
          }
        }
      }
    } catch (err) {
      console.warn('Error resolving dynamic endpoint price:', err);
    }
    return fallbackPrice;
  };
}

/**
 * Creates the full payment config for all protected endpoints.
 *
 * @param avmAddress - The Algorand wallet address that receives payments
 */
export function createPaymentConfig(avmAddress: string): EndpointConfig {
  // ─── Resume Screen Fast ─────────────────────────────────────────────────
  const resumeScreenFastGetDiscovery = declareDiscoveryExtension({
    input: { resume_url: 'https://example.com/resume.pdf' },
    output: {
      example: {
        candidateName: 'Jane Doe',
        matchScore: 88,
        keySkills: ['TypeScript', 'Node.js', 'Algorand'],
        verdict: 'Recommended for Interview',
      },
    },
  });

  const resumeScreenFastPostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { resume_url: 'https://example.com/resume.pdf', job_description: 'Software Engineer' },
    output: {
      example: {
        candidateName: 'Jane Doe',
        matchScore: 88,
        keySkills: ['TypeScript', 'Node.js', 'Algorand'],
        verdict: 'Recommended for Interview',
      },
    },
  });

  // ─── Resume Screen Accurate ─────────────────────────────────────────────
  const resumeScreenAccurateGetDiscovery = declareDiscoveryExtension({
    input: { resume_url: 'https://example.com/resume.pdf' },
    output: {
      example: {
        candidateName: 'Jane Doe',
        matchScore: 94,
        skillsBreakdown: { technical: 95, experience: 90, domainMatch: 97 },
        reasoning: 'Strong candidate with deep blockchain and backend engineering experience.',
        verdict: 'Strong Hire',
      },
    },
  });

  const resumeScreenAccuratePostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { resume_url: 'https://example.com/resume.pdf', job_description: 'Senior Full Stack Engineer' },
    output: {
      example: {
        candidateName: 'Jane Doe',
        matchScore: 94,
        skillsBreakdown: { technical: 95, experience: 90, domainMatch: 97 },
        reasoning: 'Strong candidate with deep blockchain and backend engineering experience.',
        verdict: 'Strong Hire',
      },
    },
  });

  // ─── Contract Analyze Fast ──────────────────────────────────────────────
  const contractAnalyzeFastGetDiscovery = declareDiscoveryExtension({
    input: { raw_url: 'https://example.com/contract.pdf' },
    output: {
      example: {
        documentType: 'Non-Disclosure Agreement',
        riskScore: 'Low',
        keyClauses: ['Confidentiality', 'Term: 2 Years', 'Governing Law: Delaware'],
      },
    },
  });

  const contractAnalyzeFastPostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { raw_url: 'https://example.com/contract.pdf', task_description: 'Analyze legal liabilities' },
    output: {
      example: {
        documentType: 'Non-Disclosure Agreement',
        riskScore: 'Low',
        keyClauses: ['Confidentiality', 'Term: 2 Years', 'Governing Law: Delaware'],
      },
    },
  });

  // ─── Contract Analyze Accurate ──────────────────────────────────────────
  const contractAnalyzeAccurateGetDiscovery = declareDiscoveryExtension({
    input: { raw_url: 'https://example.com/contract.pdf' },
    output: {
      example: {
        documentType: 'Master Services Agreement',
        overallRisk: 'Medium',
        flaggedRisks: [
          { clause: 'Indemnification', riskLevel: 'High', recommendation: 'Cap liability to 1x contract value' },
        ],
        complianceCheck: 'Passed',
      },
    },
  });

  const contractAnalyzeAccuratePostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { raw_url: 'https://example.com/contract.pdf', task_description: 'Deep legal risk audit' },
    output: {
      example: {
        documentType: 'Master Services Agreement',
        overallRisk: 'Medium',
        flaggedRisks: [
          { clause: 'Indemnification', riskLevel: 'High', recommendation: 'Cap liability to 1x contract value' },
        ],
        complianceCheck: 'Passed',
      },
    },
  });

  // ─── Invoice Extract Fast ───────────────────────────────────────────────
  const invoiceExtractFastGetDiscovery = declareDiscoveryExtension({
    input: { raw_url: 'https://example.com/invoice.pdf' },
    output: {
      example: {
        vendorName: 'Acme Cloud Services',
        invoiceNumber: 'INV-2026-0042',
        totalAmount: 1450.00,
        currency: 'USD',
        dueDate: '2026-09-01',
      },
    },
  });

  const invoiceExtractFastPostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { raw_url: 'https://example.com/invoice.pdf' },
    output: {
      example: {
        vendorName: 'Acme Cloud Services',
        invoiceNumber: 'INV-2026-0042',
        totalAmount: 1450.00,
        currency: 'USD',
        dueDate: '2026-09-01',
      },
    },
  });

  // ─── Invoice Extract Accurate ───────────────────────────────────────────
  const invoiceExtractAccurateGetDiscovery = declareDiscoveryExtension({
    input: { raw_url: 'https://example.com/invoice.pdf' },
    output: {
      example: {
        vendorName: 'Acme Cloud Services',
        invoiceNumber: 'INV-2026-0042',
        lineItems: [
          { description: 'GPU Server Time', qty: 10, unitPrice: 120.00, total: 1200.00 },
          { description: 'Storage S3', qty: 1, unitPrice: 250.00, total: 250.00 },
        ],
        subtotal: 1450.00,
        tax: 116.00,
        totalAmount: 1566.00,
      },
    },
  });

  const invoiceExtractAccuratePostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { raw_url: 'https://example.com/invoice.pdf' },
    output: {
      example: {
        vendorName: 'Acme Cloud Services',
        invoiceNumber: 'INV-2026-0042',
        lineItems: [
          { description: 'GPU Server Time', qty: 10, unitPrice: 120.00, total: 1200.00 },
          { description: 'Storage S3', qty: 1, unitPrice: 250.00, total: 250.00 },
        ],
        subtotal: 1450.00,
        tax: 116.00,
        totalAmount: 1566.00,
      },
    },
  });

  // ─── Code Review Fast ───────────────────────────────────────────────────
  const codeReviewFastGetDiscovery = declareDiscoveryExtension({
    input: { file_path: 'src/index.ts', raw_url: 'https://raw.githubusercontent.com/example/repo/main/src/index.ts' },
    output: {
      example: {
        overallQuality: 'B+',
        criticalIssues: 0,
        warnings: 2,
        summary: 'Clean code overall; minor optimization suggested in loop indexing.',
      },
    },
  });

  const codeReviewFastPostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { file_path: 'src/index.ts', raw_url: 'https://raw.githubusercontent.com/example/repo/main/src/index.ts', task_description: 'Analyze code quality' },
    output: {
      example: {
        overallQuality: 'B+',
        criticalIssues: 0,
        warnings: 2,
        summary: 'Clean code overall; minor optimization suggested in loop indexing.',
      },
    },
  });

  // ─── Code Review Accurate ───────────────────────────────────────────────
  const codeReviewAccurateGetDiscovery = declareDiscoveryExtension({
    input: { file_path: 'src/index.ts', raw_url: 'https://raw.githubusercontent.com/example/repo/main/src/index.ts' },
    output: {
      example: {
        overallQuality: 'A',
        securityScan: { vulnerabilities: 0, severity: 'None' },
        refactoringSuggestions: [
          { file: 'index.ts', line: 42, suggestion: 'Use memoized calculation to prevent redundant execution' },
        ],
        testCoverageEstimate: '85%',
      },
    },
  });

  const codeReviewAccuratePostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { file_path: 'src/index.ts', raw_url: 'https://raw.githubusercontent.com/example/repo/main/src/index.ts', task_description: 'Security audit and refactoring review' },
    output: {
      example: {
        overallQuality: 'A',
        securityScan: { vulnerabilities: 0, severity: 'None' },
        refactoringSuggestions: [
          { file: 'index.ts', line: 42, suggestion: 'Use memoized calculation to prevent redundant execution' },
        ],
        testCoverageEstimate: '85%',
      },
    },
  });

  // ─── SEO Audit Fast ─────────────────────────────────────────────────────
  const seoAuditFastGetDiscovery = declareDiscoveryExtension({
    input: { page_url: 'https://example.com' },
    output: {
      example: {
        targetUrl: 'https://example.com',
        score: 82,
        metaTags: { title: 'Present', description: 'Present', ogTags: 'Missing' },
        quickFixes: ['Add OpenGraph image tag', 'Fix missing alt text on 2 images'],
      },
    },
  });

  const seoAuditFastPostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { page_url: 'https://example.com' },
    output: {
      example: {
        targetUrl: 'https://example.com',
        score: 82,
        metaTags: { title: 'Present', description: 'Present', ogTags: 'Missing' },
        quickFixes: ['Add OpenGraph image tag', 'Fix missing alt text on 2 images'],
      },
    },
  });

  // ─── SEO Audit Accurate ─────────────────────────────────────────────────
  const seoAuditAccurateGetDiscovery = declareDiscoveryExtension({
    input: { page_url: 'https://example.com' },
    output: {
      example: {
        targetUrl: 'https://example.com',
        overallSeoScore: 91,
        performanceMetrics: { mobileReadability: 95, contentDepth: 'Comprehensive', keywordDensity: 'Optimal' },
        actionableRecommendations: [
          { priority: 'High', issue: 'Missing Canonical Tag', fix: 'Add rel=canonical tag in <head>' },
        ],
      },
    },
  });

  const seoAuditAccuratePostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { page_url: 'https://example.com' },
    output: {
      example: {
        targetUrl: 'https://example.com',
        overallSeoScore: 91,
        performanceMetrics: { mobileReadability: 95, contentDepth: 'Comprehensive', keywordDensity: 'Optimal' },
        actionableRecommendations: [
          { priority: 'High', issue: 'Missing Canonical Tag', fix: 'Add rel=canonical tag in <head>' },
        ],
      },
    },
  });

  // ─── Run Task ───────────────────────────────────────────────────────────
  const runTaskGetDiscovery = declareDiscoveryExtension({
    input: { task_id: 'task-9921' },
    output: {
      example: {
        taskId: 'task-9921',
        status: 'completed',
        selectedEndpoint: '/code-review-accurate',
        executionTimeMs: 1240,
        result: { success: true },
      },
    },
  });

  const runTaskPostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { task_type: 'code_review', raw_url: 'https://example.com/code.ts' },
    output: {
      example: {
        taskId: 'task-9921',
        status: 'completed',
        selectedEndpoint: '/code-review-accurate',
        executionTimeMs: 1240,
        result: { success: true },
      },
    },
  });

  // ─── Execute Task ─────────────────────────────────────────────────────────
  const executeTaskPostDiscovery = declareDiscoveryExtension({
    bodyType: 'json',
    input: { planId: '66b4c1234567890123456789' },
    output: {
      example: {
        planId: '66b4c1234567890123456789',
        status: 'completed',
        result: { success: true },
        executionTime: 1450,
      },
    },
  });

  return {
    // ── Individual AI Endpoints (dynamic pricing supported via planId) ──────

    'GET /resume-screen-fast': {
      resource: CANONICAL_ENDPOINTS['resume-screen-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.10'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['resume-screen-fast'].description,
      mimeType: 'application/json',
      extensions: resumeScreenFastGetDiscovery,
    },
    'POST /resume-screen-fast': {
      resource: CANONICAL_ENDPOINTS['resume-screen-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.10'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['resume-screen-fast'].description,
      mimeType: 'application/json',
      extensions: resumeScreenFastPostDiscovery,
    },

    'GET /resume-screen-accurate': {
      resource: CANONICAL_ENDPOINTS['resume-screen-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.25'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['resume-screen-accurate'].description,
      mimeType: 'application/json',
      extensions: resumeScreenAccurateGetDiscovery,
    },
    'POST /resume-screen-accurate': {
      resource: CANONICAL_ENDPOINTS['resume-screen-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.25'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['resume-screen-accurate'].description,
      mimeType: 'application/json',
      extensions: resumeScreenAccuratePostDiscovery,
    },

    'GET /contract-analyze-fast': {
      resource: CANONICAL_ENDPOINTS['contract-analyze-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.15'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['contract-analyze-fast'].description,
      mimeType: 'application/json',
      extensions: contractAnalyzeFastGetDiscovery,
    },
    'POST /contract-analyze-fast': {
      resource: CANONICAL_ENDPOINTS['contract-analyze-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.15'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['contract-analyze-fast'].description,
      mimeType: 'application/json',
      extensions: contractAnalyzeFastPostDiscovery,
    },

    'GET /contract-analyze-accurate': {
      resource: CANONICAL_ENDPOINTS['contract-analyze-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.35'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['contract-analyze-accurate'].description,
      mimeType: 'application/json',
      extensions: contractAnalyzeAccurateGetDiscovery,
    },
    'POST /contract-analyze-accurate': {
      resource: CANONICAL_ENDPOINTS['contract-analyze-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.35'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['contract-analyze-accurate'].description,
      mimeType: 'application/json',
      extensions: contractAnalyzeAccuratePostDiscovery,
    },

    'GET /invoice-extract-fast': {
      resource: CANONICAL_ENDPOINTS['invoice-extract-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.08'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['invoice-extract-fast'].description,
      mimeType: 'application/json',
      extensions: invoiceExtractFastGetDiscovery,
    },
    'POST /invoice-extract-fast': {
      resource: CANONICAL_ENDPOINTS['invoice-extract-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.08'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['invoice-extract-fast'].description,
      mimeType: 'application/json',
      extensions: invoiceExtractFastPostDiscovery,
    },

    'GET /invoice-extract-accurate': {
      resource: CANONICAL_ENDPOINTS['invoice-extract-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.20'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['invoice-extract-accurate'].description,
      mimeType: 'application/json',
      extensions: invoiceExtractAccurateGetDiscovery,
    },
    'POST /invoice-extract-accurate': {
      resource: CANONICAL_ENDPOINTS['invoice-extract-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.20'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['invoice-extract-accurate'].description,
      mimeType: 'application/json',
      extensions: invoiceExtractAccuratePostDiscovery,
    },

    'GET /code-review-fast': {
      resource: CANONICAL_ENDPOINTS['code-review-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.10'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['code-review-fast'].description,
      mimeType: 'application/json',
      extensions: codeReviewFastGetDiscovery,
    },
    'POST /code-review-fast': {
      resource: CANONICAL_ENDPOINTS['code-review-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.10'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['code-review-fast'].description,
      mimeType: 'application/json',
      extensions: codeReviewFastPostDiscovery,
    },

    'GET /code-review-accurate': {
      resource: CANONICAL_ENDPOINTS['code-review-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.20'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['code-review-accurate'].description,
      mimeType: 'application/json',
      extensions: codeReviewAccurateGetDiscovery,
    },
    'POST /code-review-accurate': {
      resource: CANONICAL_ENDPOINTS['code-review-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.20'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['code-review-accurate'].description,
      mimeType: 'application/json',
      extensions: codeReviewAccuratePostDiscovery,
    },

    'GET /seo-audit-fast': {
      resource: CANONICAL_ENDPOINTS['seo-audit-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.10'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['seo-audit-fast'].description,
      mimeType: 'application/json',
      extensions: seoAuditFastGetDiscovery,
    },
    'POST /seo-audit-fast': {
      resource: CANONICAL_ENDPOINTS['seo-audit-fast'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.10'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['seo-audit-fast'].description,
      mimeType: 'application/json',
      extensions: seoAuditFastPostDiscovery,
    },

    'GET /seo-audit-accurate': {
      resource: CANONICAL_ENDPOINTS['seo-audit-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.25'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['seo-audit-accurate'].description,
      mimeType: 'application/json',
      extensions: seoAuditAccurateGetDiscovery,
    },
    'POST /seo-audit-accurate': {
      resource: CANONICAL_ENDPOINTS['seo-audit-accurate'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.25'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['seo-audit-accurate'].description,
      mimeType: 'application/json',
      extensions: seoAuditAccuratePostDiscovery,
    },

    'GET /run-task': {
      resource: CANONICAL_ENDPOINTS['run-task'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.25'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['run-task'].description,
      mimeType: 'application/json',
      extensions: runTaskGetDiscovery,
    },
    'POST /run-task': {
      resource: CANONICAL_ENDPOINTS['run-task'].resourceUrl,
      accepts: [{
        scheme: 'exact',
        price: createDynamicPriceResolver('$0.25'),
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: CANONICAL_ENDPOINTS['run-task'].description,
      mimeType: 'application/json',
      extensions: runTaskPostDiscovery,
    },
  };
}

export default createPaymentConfig;

