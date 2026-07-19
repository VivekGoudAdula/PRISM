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

import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from '@x402/avm';
import type { DynamicPrice } from '@x402/core/server';
import { Task } from './models/Task';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StaticPaymentOption {
  scheme: 'exact';
  price: string;
  network: string;
  payTo: string;
  extra: { asset: number };
}

export interface DynamicPaymentOption {
  scheme: 'exact';
  price: DynamicPrice;
  network: string;
  payTo: string;
  extra: { asset: number };
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
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Weather data access — $0.005 USDC per call',
    },

    'POST /resume-screen-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.20',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Fast Resume Screening — $0.20 USDC per call',
    },

    'POST /resume-screen-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.45',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Accurate Resume Screening — $0.45 USDC per call',
    },

    'POST /contract-analyze-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.30',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Fast Contract Analysis — $0.30 USDC per call',
    },

    'POST /contract-analyze-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.60',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Accurate Contract Analysis — $0.60 USDC per call',
    },

    'POST /invoice-extract-fast': {
      accepts: [{
        scheme: 'exact',
        price: '$0.15',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Fast Invoice Extraction — $0.15 USDC per call',
    },

    'POST /invoice-extract-accurate': {
      accepts: [{
        scheme: 'exact',
        price: '$0.35',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Accurate Invoice Extraction — $0.35 USDC per call',
    },

    // ── NEW: Dynamic-price orchestrated execution ────────────────────────────
    // Price = plan.totalCost = (executionQuantity × unitPrice) + platformFee
    // Resolved live from MongoDB by reading the planId query parameter.
    'POST /execute-task': {
      accepts: [{
        scheme: 'exact',
        price: executionTaskDynamicPrice,
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: Number(USDC_TESTNET_ASA_ID) },
      }],
      description: 'Dynamic-price task execution — quantity × unitPrice + $0.75 platform fee',
    },
  };
}

export default createPaymentConfig;
