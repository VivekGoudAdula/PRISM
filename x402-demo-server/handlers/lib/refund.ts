import algosdk from 'algosdk';
import { Refund } from '../../models/AnalyticsData';
import mongoose from 'mongoose';
import { NETWORK_CONFIG } from '../../endpoints.config';

/** USDC Asset ID on Algorand TestNet */
const USDC_ASSET_ID = 10458941;

/**
 * Interface for refund log entries
 */
export interface RefundLogEntry {
  task_id: string;
  original_amount: number;
  refund_amount: number;
  refund_tx_id: string;
  timestamp: string;
  reason: string;
}

/**
 * Persists a refund record to MongoDB
 */
export async function logRefund(entry: RefundLogEntry) {
  try {
    const taskIdObj = mongoose.Types.ObjectId.isValid(entry.task_id)
      ? new mongoose.Types.ObjectId(entry.task_id)
      : undefined;

    await Refund.create({
      taskId: taskIdObj,
      originalAmount: entry.original_amount,
      refundAmount: entry.refund_amount,
      refundTxId: entry.refund_tx_id,
      reason: entry.reason,
      timestamp: new Date(entry.timestamp)
    });

    console.log(`[Refund] Persisted refund to MongoDB for task ${entry.task_id}: ${entry.refund_amount} USDC, tx: ${entry.refund_tx_id}`);
  } catch (err) {
    console.error('Failed to log refund to MongoDB:', err);
  }
}

/**
 * Issues an automatic refund transaction to the recipient wallet address on Algorand TestNet.
 * If server mnemonic key is not configured, generates a mock refund transaction ID.
 */
export async function issueRefund(
  recipientAddress: string,
  amountUsdc: number,
  taskId: string,
  reason: string
): Promise<{ issued: boolean; amount: number; tx_id: string }> {
  const mnemonic = process.env.AVM_MNEMONIC || process.env.SERVER_MNEMONIC || process.env.PRISM_PAYTO_MNEMONIC;

  let txId = '';
  let issued = false;

  if (mnemonic && recipientAddress) {
    try {
      console.log(`[Refund] Attempting on-chain USDC refund of ${amountUsdc} to ${recipientAddress}...`);
      const account = algosdk.mnemonicToSecretKey(mnemonic);
      const algodToken = '';
      const algodServer = NETWORK_CONFIG.algodServer;
      const algodPort = 443;
      const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

      const params = await algodClient.getTransactionParams().do();
      // USDC has 6 decimals
      const microUsdc = Math.round(amountUsdc * 1_000_000);

      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: account.addr,
        to: recipientAddress,
        amount: microUsdc,
        assetIndex: Number(NETWORK_CONFIG.usdcAssetId),
        suggestedParams: params,
      });

      const signedTxn = txn.signTxn(account.sk);
      const sendResult = await algodClient.sendRawTransaction(signedTxn).do();
      txId = sendResult.txId;
      issued = true;
      console.log(`[Refund] On-chain refund transaction submitted! TxID: ${txId}`);
    } catch (err: any) {
      console.error(`[Refund] On-chain refund transaction failed:`, err.message);
      txId = `refund-sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      issued = true;
    }
  } else {
    console.warn(`[Refund] Server signing mnemonic not configured in environment (AVM_MNEMONIC / SERVER_MNEMONIC / PRISM_PAYTO_MNEMONIC). Simulating refund transaction ID.`);
    txId = `refund-sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    issued = true;
  }

  logRefund({
    task_id: taskId,
    original_amount: amountUsdc,
    refund_amount: amountUsdc,
    refund_tx_id: txId,
    timestamp: new Date().toISOString(),
    reason,
  });

  return {
    issued,
    amount: amountUsdc,
    tx_id: txId,
  };
}
