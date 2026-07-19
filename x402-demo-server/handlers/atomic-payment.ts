import type { Context } from 'hono';
import algosdk from 'algosdk';
import { Task } from '../models/Task';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Algorand TestNet public node (no token required).
 * Can be overridden via ALGOD_URL / ALGOD_TOKEN env vars.
 */
const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const ALGOD_PORT = process.env.ALGOD_PORT ? Number(process.env.ALGOD_PORT) : 443;

/**
 * USDC ASA ID on Algorand TestNet.
 * Must match the asset ID used by x402 payments.
 */
const USDC_TESTNET_ASA_ID = Number(process.env.USDC_ASA_ID || 10458941);

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Converts a USDC dollar amount to its on-chain micro-USDC integer representation.
 * USDC on Algorand uses 6 decimal places.
 *
 * @param dollars - Amount in USD (e.g. 0.45)
 * @returns BigInt micro-USDC amount (e.g. 450000n)
 */
function toMicroUsdc(dollars: number): bigint {
  return BigInt(Math.round(dollars * 1_000_000));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * POST /prepare-atomic-group?planId=<id>
 *
 * PUBLIC — no payment required.
 *
 * Builds an Algorand Atomic Transaction Group for a planned task:
 *   - One USDC ASA transfer per execution unit (file), each for unitPrice USDC
 *   - One USDC ASA transfer for the platform fee
 *   - All transactions assigned the same Group ID via algosdk.assignGroupID()
 *
 * The client:
 *   1. Receives the array of unsigned transactions (base64-encoded)
 *   2. Signs the full group in ONE Pera Wallet popup
 *   3. Submits to Algorand and waits for confirmation
 *   4. Calls POST /execute-task with groupId + txIds as proof of payment
 *
 * Body:
 *   { senderAddress: string }  — the user's Algorand wallet address
 *
 * Response:
 *   {
 *     groupId:      string          — base64-encoded Algorand Group ID
 *     txnCount:     number          — total transactions in the group (N + 1)
 *     unsignedTxns: string[]        — base64-encoded unsigned txns (one per payment)
 *     breakdown: {
 *       executionTxns: number,      — count of per-file payment txns
 *       platformFeeTxn: number,     — always 1
 *       unitPrice:      number,
 *       platformFee:    number,
 *       totalCost:      number,
 *     }
 *   }
 */
export async function handlePrepareAtomicGroupRequest(c: Context) {
  try {
    // ── Step 1: Validate inputs ──────────────────────────────────────────────
    const planId = c.req.query('planId');
    if (!planId) {
      return c.json({ error: 'planId query parameter is required' }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const { senderAddress } = body as { senderAddress?: string };

    if (!senderAddress || typeof senderAddress !== 'string') {
      return c.json({ error: 'senderAddress is required in the request body' }, 400);
    }

    // Validate the sender address format
    if (!algosdk.isValidAddress(senderAddress)) {
      return c.json({ error: `Invalid Algorand address: ${senderAddress}` }, 400);
    }

    // ── Step 2: Load the execution plan from the DB ──────────────────────────
    const plan = await Task.findById(planId).lean();
    if (!plan) {
      return c.json({ error: `Plan not found: ${planId}` }, 404);
    }
    if (plan.status !== 'planned') {
      return c.json({
        error: `Plan is not in 'planned' state (current: ${plan.status}). Cannot prepare payment.`,
      }, 409);
    }

    const { unitPrice, executionQuantity, platformFee } = plan;
    const receiverAddress: string = process.env.AVM_ADDRESS || '';

    if (!receiverAddress || !algosdk.isValidAddress(receiverAddress)) {
      return c.json({ error: 'Server misconfiguration: AVM_ADDRESS is missing or invalid' }, 500);
    }

    // ── Step 3: Connect to Algorand TestNet ──────────────────────────────────
    const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ALGOD_PORT);
    const suggestedParams = await algodClient.getTransactionParams().do();

    // ── Step 4: Build per-execution payment transactions ─────────────────────
    // One USDC ASA transfer per execution unit (file).
    const execTxns: algosdk.Transaction[] = [];

    for (let i = 0; i < executionQuantity; i++) {
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: senderAddress,
        receiver: receiverAddress,
        amount: toMicroUsdc(unitPrice),
        assetIndex: USDC_TESTNET_ASA_ID,
        suggestedParams,
        note: new TextEncoder().encode(
          `Prism execution #${i + 1} of ${executionQuantity} — planId: ${planId}`,
        ),
      });
      execTxns.push(txn);
    }

    // ── Step 5: Build platform fee transaction ───────────────────────────────
    const platformFeeTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: senderAddress,
      receiver: receiverAddress,
      amount: toMicroUsdc(platformFee),
      assetIndex: USDC_TESTNET_ASA_ID,
      suggestedParams,
      note: new TextEncoder().encode(
        `Prism platform fee — planId: ${planId}`,
      ),
    });

    // ── Step 6: Assign Group ID — this makes them atomic ────────────────────
    const allTxns = [...execTxns, platformFeeTxn];
    algosdk.assignGroupID(allTxns);

    // Extract the group ID (all txns share the same groupID after assignment)
    const groupIdBytes = allTxns[0].group;
    if (!groupIdBytes) {
      return c.json({ error: 'Failed to assign Group ID to transactions' }, 500);
    }
    const groupId = Buffer.from(groupIdBytes).toString('base64');

    // ── Step 7: Encode unsigned transactions for the client ──────────────────
    // Each transaction is msgpack-encoded and base64-encoded for transport.
    const unsignedTxns: string[] = allTxns.map((txn) =>
      Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64'),
    );

    console.log(
      `✓ Prepared atomic group: ${allTxns.length} txns, groupId=${groupId}, planId=${planId}`,
    );

    // ── Step 8: Return group metadata to client ──────────────────────────────
    return c.json({
      groupId,
      txnCount: allTxns.length,
      unsignedTxns,
      breakdown: {
        executionTxns: executionQuantity,
        platformFeeTxn: 1,
        unitPrice,
        platformFee,
        totalCost: plan.totalCost,
      },
    });
  } catch (error: any) {
    console.error('Error in prepare-atomic-group handler:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
}
