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

import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2, USDC_TESTNET_ASA_ID, USDC_MAINNET_ASA_ID } from '@x402/avm';
import type { DynamicPrice } from '@x402/core/server';
import { Task } from './models/Task';

// ─── Network Mode Configuration ─────────────────────────────────────────────

const rawNetworkMode = (process.env.NETWORK_MODE || 'testnet').toLowerCase().trim();
export const NETWORK_MODE = rawNetworkMode === 'mainnet' ? 'mainnet' : 'testnet';

export const NETWORK_CONFIG = NETWORK_MODE === 'mainnet' 
  ? {
      caip2: ALGORAND_MAINNET_CAIP2,
      usdcAssetId: Number(USDC_MAINNET_ASA_ID), // 31566704
      name: 'MAINNET',
    }
  : {
      caip2: ALGORAND_TESTNET_CAIP2,
      usdcAssetId: Number(USDC_TESTNET_ASA_ID), // 10458941
      name: 'TESTNET',
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

  /**
   * Dynamic price resolver for /execute-task.
   *
   * Reads the `planId` query parameter from the request context, fetches the
   * corresponding Task document, and returns its pre-computed totalCost as the
   * x402 payment price. This makes the blockchain payment amount exactly equal
   * to (executionQuantity × unitPrice + platformFee).
   */
  const executionTaskDynamicPrice: DynamicPrice = async (context) => {
    const planId = context.adapter.getQueryParam?.('planId') as string | undefined;

    if (!planId) {
      // Fallback minimum to trigger 402 — handler will reject missing planId
      return '$0.01';
    }

    try {
      const plan = await Task.findById(planId).lean();
      if (!plan || !plan.totalCost || plan.status !== 'planned') {
        // Fallback: plan not found or not ready — return a minimum to trigger 402
        return '$0.01';
      }
      // Return the exact dynamic total e.g. "$12.00"
      return `$${plan.totalCost.toFixed(2)}`;
    } catch (err) {
      console.error('executionTaskDynamicPrice: DB lookup failed:', err);
      return '$0.01';
    }
  };

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
        price: '$0.20',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Screens candidate resumes against job criteria using Llama 3 for fast initial candidate ranking.',
    },

    'POST /resume-screen-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.45',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Screens a batch of resumes against a target job description and returns ranked candidates with detailed match scores using high-precision LLM reasoning.',
    },

    'POST /contract-analyze-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.30',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Extracts core legal clauses, liabilities, and obligations from contract documents with fast turnarounds.',
    },

    'POST /contract-analyze-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.60',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs comprehensive legal contract risk analysis, clause extraction, and anomaly flagging with deep reasoning.',
    },

    'POST /invoice-extract-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.15',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Extracts vendor details, invoice numbers, totals, and line items quickly from billing documents.',
    },

    'POST /invoice-extract-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.35',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Performs high-precision structured data extraction of line items, taxes, vendor info, and totals from complex multi-page invoices.',
    },

    'POST /run-task': {
      accepts: [{
        scheme: 'exact',
        price: '$0.75',
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Orchestrates document classification, endpoint selection, execution, and output verification with automated refund protection.',
    },

    'POST /execute-task': {
      accepts: [{
        scheme: 'exact',
        price: executionTaskDynamicPrice,
        network: NETWORK_CONFIG.caip2,
        payTo: avmAddress,
        extra: { asset: NETWORK_CONFIG.usdcAssetId, tag: 'x402-global-challenge' },
      }],
      description: 'Executes planned batch multi-document AI processing workflows under a pre-calculated dynamic cost plan.',
    },

  };
}

export default createPaymentConfig;

