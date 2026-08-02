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
  };
}

// ─── Config factory ──────────────────────────────────────────────────────────

/**
 * Creates the full payment config for all protected endpoints.
 *
 * @param avmAddress - The Algorand wallet address that receives payments
 */
export function createPaymentConfig(avmAddress: string): EndpointConfig {



  return {
    // ── Individual AI Endpoints (static, per-call pricing) ──────────────────

    'GET /weather': {
      accepts: [{
        scheme: 'exact',
        price: '$0.005',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Fetches real-time weather data and forecast metrics per location query.',
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
    },

    'POST /execute-task': {
      accepts: [{
        scheme: 'exact',
        price: async (req: any) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const planId = url.searchParams.get('planId');
            if (planId) {
              const task = await Task.findById(planId);
              if (task && typeof task.totalCost === 'number') {
                return `$${task.totalCost.toFixed(2)}`;
              }
            }
          } catch (err) {
            console.error('Error computing dynamic price for /execute-task:', err);
          }
          return '$0.75';
        },
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Executes planned task with dynamic batch payment in one consolidated transaction.',
    },
  };
}

export default createPaymentConfig;

