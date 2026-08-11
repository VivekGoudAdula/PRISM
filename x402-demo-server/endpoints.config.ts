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
import type { DynamicPrice } from '@x402/core/server';
import { declareDiscoveryExtension } from '@x402-avm/extensions';
import mongoose from 'mongoose';
import { Task } from './models/Task';

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
    accepts: Array<StaticPaymentOption | DynamicPaymentOption>;
    description: string;
    mimeType?: string;
    extensions?: Record<string, any>;
  };
}

// ─── Config factory ──────────────────────────────────────────────────────────

/**
 * Creates the full payment config for all protected endpoints.
 *
 * @param avmAddress - The Algorand wallet address that receives payments
 */
export function createPaymentConfig(avmAddress: string): EndpointConfig {
  const resumeScreenFastDiscovery = declareDiscoveryExtension({
    output: {
      example: {
        candidateName: 'Jane Doe',
        matchScore: 88,
        keySkills: ['TypeScript', 'Node.js', 'Algorand'],
        verdict: 'Recommended for Interview',
      },
    },
  });

  const resumeScreenAccurateDiscovery = declareDiscoveryExtension({
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

  const contractAnalyzeFastDiscovery = declareDiscoveryExtension({
    output: {
      example: {
        documentType: 'Non-Disclosure Agreement',
        riskScore: 'Low',
        keyClauses: ['Confidentiality', 'Term: 2 Years', 'Governing Law: Delaware'],
      },
    },
  });

  const contractAnalyzeAccurateDiscovery = declareDiscoveryExtension({
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

  const invoiceExtractFastDiscovery = declareDiscoveryExtension({
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

  const invoiceExtractAccurateDiscovery = declareDiscoveryExtension({
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

  const codeReviewFastDiscovery = declareDiscoveryExtension({
    output: {
      example: {
        overallQuality: 'B+',
        criticalIssues: 0,
        warnings: 2,
        summary: 'Clean code overall; minor optimization suggested in loop indexing.',
      },
    },
  });

  const codeReviewAccurateDiscovery = declareDiscoveryExtension({
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

  const seoAuditFastDiscovery = declareDiscoveryExtension({
    output: {
      example: {
        targetUrl: 'https://example.com',
        score: 82,
        metaTags: { title: 'Present', description: 'Present', ogTags: 'Missing' },
        quickFixes: ['Add OpenGraph image tag', 'Fix missing alt text on 2 images'],
      },
    },
  });

  const seoAuditAccurateDiscovery = declareDiscoveryExtension({
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

  const runTaskDiscovery = declareDiscoveryExtension({
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

  return {
    // ── Individual AI Endpoints (static, per-call pricing) ──────────────────

    'GET /resume-screen-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.10',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Screens candidate resumes against job criteria using Llama 3 for fast initial candidate ranking.',
      mimeType: 'application/json',
      extensions: resumeScreenFastDiscovery,
    },
    'POST /resume-screen-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.10',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Screens candidate resumes against job criteria using Llama 3 for fast initial candidate ranking.',
      mimeType: 'application/json',
      extensions: resumeScreenFastDiscovery,
    },

    'GET /resume-screen-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.25',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Screens a batch of resumes against a target job description and returns ranked candidates with detailed match scores using high-precision LLM reasoning.',
      mimeType: 'application/json',
      extensions: resumeScreenAccurateDiscovery,
    },
    'POST /resume-screen-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.25',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Screens a batch of resumes against a target job description and returns ranked candidates with detailed match scores using high-precision LLM reasoning.',
      mimeType: 'application/json',
      extensions: resumeScreenAccurateDiscovery,
    },

    'GET /contract-analyze-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.15',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Extracts core legal clauses, liabilities, and obligations from contract documents with fast turnarounds.',
      mimeType: 'application/json',
      extensions: contractAnalyzeFastDiscovery,
    },
    'POST /contract-analyze-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.15',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Extracts core legal clauses, liabilities, and obligations from contract documents with fast turnarounds.',
      mimeType: 'application/json',
      extensions: contractAnalyzeFastDiscovery,
    },

    'GET /contract-analyze-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.35',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs comprehensive legal contract risk analysis, clause extraction, and anomaly flagging with deep reasoning.',
      mimeType: 'application/json',
      extensions: contractAnalyzeAccurateDiscovery,
    },
    'POST /contract-analyze-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.35',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs comprehensive legal contract risk analysis, clause extraction, and anomaly flagging with deep reasoning.',
      mimeType: 'application/json',
      extensions: contractAnalyzeAccurateDiscovery,
    },

    'GET /invoice-extract-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.08',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Extracts vendor details, invoice numbers, totals, and line items quickly from billing documents.',
      mimeType: 'application/json',
      extensions: invoiceExtractFastDiscovery,
    },
    'POST /invoice-extract-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.08',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Extracts vendor details, invoice numbers, totals, and line items quickly from billing documents.',
      mimeType: 'application/json',
      extensions: invoiceExtractFastDiscovery,
    },

    'GET /invoice-extract-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.20',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs high-precision structured data extraction of line items, taxes, vendor info, and totals from complex multi-page invoices.',
      mimeType: 'application/json',
      extensions: invoiceExtractAccurateDiscovery,
    },
    'POST /invoice-extract-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.20',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs high-precision structured data extraction of line items, taxes, vendor info, and totals from complex multi-page invoices.',
      mimeType: 'application/json',
      extensions: invoiceExtractAccurateDiscovery,
    },

    'GET /code-review-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.10',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Reviews a single code file for bugs, security issues, syntax errors, and code quality problems with fast LLM turnarounds.',
      mimeType: 'application/json',
      extensions: codeReviewFastDiscovery,
    },
    'POST /code-review-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.10',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Reviews a single code file for bugs, security issues, syntax errors, and code quality problems with fast LLM turnarounds.',
      mimeType: 'application/json',
      extensions: codeReviewFastDiscovery,
    },

    'GET /code-review-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.20',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs comprehensive senior-engineer code review and security auditing on a single code file using high-precision LLM reasoning.',
      mimeType: 'application/json',
      extensions: codeReviewAccurateDiscovery,
    },
    'POST /code-review-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.20',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs comprehensive senior-engineer code review and security auditing on a single code file using high-precision LLM reasoning.',
      mimeType: 'application/json',
      extensions: codeReviewAccurateDiscovery,
    },

    'GET /seo-audit-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.10',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs fast rule-based SEO audit checks on a webpage including metadata, headings, images, links, and readability.',
      mimeType: 'application/json',
      extensions: seoAuditFastDiscovery,
    },
    'POST /seo-audit-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.10',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs fast rule-based SEO audit checks on a webpage including metadata, headings, images, links, and readability.',
      mimeType: 'application/json',
      extensions: seoAuditFastDiscovery,
    },

    'GET /seo-audit-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.25',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs deep LLM-assisted SEO auditing analyzing readability, content depth, keyword relevance, and technical SEO structure.',
      mimeType: 'application/json',
      extensions: seoAuditAccurateDiscovery,
    },
    'POST /seo-audit-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.25',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs deep LLM-assisted SEO auditing analyzing readability, content depth, keyword relevance, and technical SEO structure.',
      mimeType: 'application/json',
      extensions: seoAuditAccurateDiscovery,
    },

    'GET /run-task': {
      accepts: [{
        scheme: 'exact',
        price: '$0.25',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Orchestrates document classification, endpoint selection, execution, and output verification with automated refund protection.',
      mimeType: 'application/json',
      extensions: runTaskDiscovery,
    },
    'POST /run-task': {
      accepts: [{
        scheme: 'exact',
        price: '$0.25',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Orchestrates document classification, endpoint selection, execution, and output verification with automated refund protection.',
      mimeType: 'application/json',
      extensions: runTaskDiscovery,
    },
  };
}

export default createPaymentConfig;

