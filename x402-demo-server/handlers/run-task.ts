import type { Context } from 'hono';
import { handleClassifyTaskRequest } from './classify-task';
import { handleSelectEndpointRequest } from './select-endpoint';
import { handleResumeScreenFastRequest } from './resume-screen-fast';
import { handleResumeScreenAccurateRequest } from './resume-screen-accurate';
import { handleContractAnalyzeFastRequest } from './contract-analyze-fast';
import { handleContractAnalyzeAccurateRequest } from './contract-analyze-accurate';
import { handleInvoiceExtractFastRequest } from './invoice-extract-fast';
import { handleInvoiceExtractAccurateRequest } from './invoice-extract-accurate';
import { handleClaimExtractFastRequest } from './claim-extract-fast';
import { handleClaimExtractAccurateRequest } from './claim-extract-accurate';
import { handleClaimVerifyFastRequest } from './claim-verify-fast';
import { handleClaimVerifyAccurateRequest } from './claim-verify-accurate';
import { handleSourceCompareFastRequest } from './source-compare-fast';
import { handleSourceCompareAccurateRequest } from './source-compare-accurate';
import { handleNewsResearchFastRequest } from './news-research-fast';
import { handleNewsResearchAccurateRequest } from './news-research-accurate';
import { verifyOutput } from './lib/verify-output';
import { updateReputation } from './lib/reputation-store';
import { extractText } from './lib/extract-document';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Task } from '../models/Task';
import { Payments } from '../models/Payments';
import { EndpointUsage } from '../models/EndpointUsage';
import { AuditLog } from '../models/AuditLog';

/**
 * POST /run-task
 * Orchestrates classification, selection, and invocation of the winning handler.
 */
export async function handleRunTaskRequest(c: Context) {
  const startTime = Date.now();
  let taskRecord: any = null;
  let user: any = null;

  try {
    console.log('✓ PAYMENT VERIFIED - POST /run-task handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { task_description, files = [] } = body;

    if (!task_description || typeof task_description !== 'string') {
      return c.json({ error: 'task_description is required' }, 400);
    }

    // Identify user from Auth context
    const tokenUser = c.get('user');
    if (tokenUser && tokenUser.userId) {
      user = await User.findById(tokenUser.userId);
    }

    // If no authenticated user (should not happen if requireAuth is on), create a guest or throw
    if (!user) {
      // Find or create a default user for backward compatibility / testing
      user = await User.findOne({ email: 'guest@prism.ai' });
      if (!user) {
        user = await User.create({
          fullName: 'Guest User',
          email: 'guest@prism.ai',
          passwordHash: 'guest-hashed-pwd',
          role: 'user',
        });
      }
    }

    // 1. Save task - Pending
    taskRecord = await Task.create({
      userId: user._id,
      prompt: task_description,
      category: 'pending',
      status: 'pending',
    });

    await AuditLog.create({
      userId: user._id,
      action: 'Task Started',
      details: { taskId: taskRecord._id, prompt: task_description },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    // Centrally extract text from files once before any routing/handling
    const extractedFiles: { filename: string; text: string; method: 'pdf-text' | 'ocr' | 'plain' }[] = [];
    for (const file of files) {
      if (file.filename && file.content_base64) {
        try {
          const extResult = await extractText(file.filename, file.content_base64);
          extractedFiles.push({
            filename: file.filename,
            text: extResult.text,
            method: extResult.method,
          });
        } catch (err: any) {
          console.error(`Error extracting text from file ${file.filename}:`, err);
          taskRecord.status = 'failed';
          await taskRecord.save();
          await AuditLog.create({
            userId: user._id,
            action: 'Task Failed',
            details: { taskId: taskRecord._id, error: `File extraction failed: ${err.message}` },
            ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
          });
          return c.json({ error: `File extraction failed for ${file.filename}: ${err.message}` }, 400);
        }
      }
    }

    // 2. Planner runs -> Update Task Category
    const mockContextClassify = {
      req: {
        json: async () => ({ task_description }),
      },
      json: (data: any) => data,
    } as unknown as Context;

    const classifyResult: any = await handleClassifyTaskRequest(mockContextClassify);
    if (!classifyResult || classifyResult.error || classifyResult.category === 'unsupported') {
      taskRecord.status = 'failed';
      await taskRecord.save();
      await AuditLog.create({
        userId: user._id,
        action: 'Task Classification Failed',
        details: { taskId: taskRecord._id, category: 'unsupported' },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      });
      return c.json({
        category: 'unsupported',
        message: "This document doesn't match a supported task type yet (resume screening, contract analysis, or invoice extraction)."
      }, 200);
    }

    const category = classifyResult.category;
    taskRecord.category = category;
    taskRecord.plannerOutput = classifyResult;
    await taskRecord.save();

    // 2b. Build semantic-map once per extracted document after category is known
    const { buildSemanticMap } = await import('./lib/semantic-map');
    const processedFiles: { filename: string; text: string; semantic_map?: object; method: 'pdf-text' | 'ocr' | 'plain' }[] = [];

    for (const file of extractedFiles) {
      const mapResult = await buildSemanticMap(category, file.text, file.filename);
      processedFiles.push({
        filename: file.filename,
        text: file.text,
        semantic_map: mapResult.map,
        method: file.method,
      });
    }

    // 3. Endpoint selected -> Update Task
    const mockContextSelect = {
      req: {
        json: async () => ({ category }),
      },
      json: (data: any) => data,
    } as unknown as Context;

    const selectResult: any = await handleSelectEndpointRequest(mockContextSelect);
    if (!selectResult || selectResult.error || !selectResult.winner) {
      taskRecord.status = 'failed';
      await taskRecord.save();
      await AuditLog.create({
        userId: user._id,
        action: 'Task Failed',
        details: { taskId: taskRecord._id, error: 'Endpoint selection failed' },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      });
      return c.json({
        error: 'Failed to select endpoint for task',
        details: selectResult
      }, 500);
    }

    const winner_endpoint = selectResult.winner.endpoint_path;
    const price_paid_to_endpoint = selectResult.winner.price;

    taskRecord.selectedEndpoint = winner_endpoint;
    taskRecord.allCandidateEndpoints = selectResult.endpoints;
    taskRecord.endpointChosenReason = `Highest score based on reputation, latency, and cost of ${price_paid_to_endpoint} USDC`;
    taskRecord.endpointCost = price_paid_to_endpoint;
    taskRecord.totalCost = price_paid_to_endpoint;
    await taskRecord.save();

    await AuditLog.create({
      userId: user._id,
      action: 'Endpoint Selected',
      details: { taskId: taskRecord._id, winner_endpoint, cost: price_paid_to_endpoint },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    // 4. Payment complete -> Update Payment
    const paymentSignature = c.req.header('payment-signature') || `mock-signature-${new mongoose.Types.ObjectId()}`;
    const paymentRecord = await Payments.create({
      taskId: taskRecord._id,
      userId: user._id,
      x402TransactionId: paymentSignature,
      amount: 0.75, // $0.75 USDC standard task cost charged to end user
      blockchain: 'Algorand',
      currency: 'USDC',
      status: 'completed',
    });

    await AuditLog.create({
      userId: user._id,
      action: 'Payment Completed',
      details: { taskId: taskRecord._id, paymentId: paymentRecord._id, amount: 0.75 },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    // 5. Execution complete -> Update Task
    const mockContextHandler = {
      req: {
        json: async () => ({ task_description, files: processedFiles }),
      },
      json: (data: any) => data,
    } as unknown as Context;

    let handlerResult: any = null;

    switch (winner_endpoint) {
      case '/resume-screen-fast':
        handlerResult = await handleResumeScreenFastRequest(mockContextHandler);
        break;
      case '/resume-screen-accurate':
        handlerResult = await handleResumeScreenAccurateRequest(mockContextHandler);
        break;
      case '/contract-analyze-fast':
        handlerResult = await handleContractAnalyzeFastRequest(mockContextHandler);
        break;
      case '/contract-analyze-accurate':
        handlerResult = await handleContractAnalyzeAccurateRequest(mockContextHandler);
        break;
      case '/invoice-extract-fast':
        handlerResult = await handleInvoiceExtractFastRequest(mockContextHandler);
        break;
      case '/invoice-extract-accurate':
        handlerResult = await handleInvoiceExtractAccurateRequest(mockContextHandler);
        break;
      case '/claim-extract-fast':
      case '/claim-extract':
        handlerResult = await handleClaimExtractFastRequest(mockContextHandler);
        break;
      case '/claim-extract-accurate':
        handlerResult = await handleClaimExtractAccurateRequest(mockContextHandler);
        break;
      case '/claim-verify-fast':
      case '/claim-verify':
      case '/api/claim-verify':
        handlerResult = await handleClaimVerifyFastRequest(mockContextHandler);
        break;
      case '/claim-verify-accurate':
        handlerResult = await handleClaimVerifyAccurateRequest(mockContextHandler);
        break;
      case '/source-compare-fast':
      case '/source-compare':
      case '/api/source-compare':
        handlerResult = await handleSourceCompareFastRequest(mockContextHandler);
        break;
      case '/source-compare-accurate':
        handlerResult = await handleSourceCompareAccurateRequest(mockContextHandler);
        break;
      case '/news-research-fast':
      case '/news-research':
      case '/api/news-research':
        handlerResult = await handleNewsResearchFastRequest(mockContextHandler);
        break;
      case '/news-research-accurate':
        handlerResult = await handleNewsResearchAccurateRequest(mockContextHandler);
        break;
      default:
        taskRecord.status = 'failed';
        await taskRecord.save();
        return c.json({ error: `Unknown winning endpoint: ${winner_endpoint}` }, 500);
    }

    const executionTime = Date.now() - startTime;

    taskRecord.status = 'completed';
    taskRecord.output = handlerResult;
    taskRecord.executionTime = executionTime;
    await taskRecord.save();

    await AuditLog.create({
      userId: user._id,
      action: 'Task Completed',
      details: { taskId: taskRecord._id, executionTime },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    // 6. Verification complete -> Update Verification
    const verification = verifyOutput(category, handlerResult);
    updateReputation(winner_endpoint, verification.passed);

    taskRecord.verificationScore = verification.passed ? 1 : 0;
    taskRecord.verificationStatus = verification.passed ? 'passed' : 'failed';

    let refund: { issued: boolean; amount: number; tx_id: string } | undefined = undefined;

    if (!verification.passed) {
      const { issueRefund } = await import('./lib/refund');
      const refundRecipient = user.walletAddress || c.req.header('x-payer-address') || c.req.header('payment-sender') || '';
      const chargedAmount = 0.75;
      refund = await issueRefund(refundRecipient, chargedAmount, taskRecord._id.toString(), verification.reason);
      
      taskRecord.status = 'failed';
      taskRecord.refundIssued = true;
      taskRecord.refundTxId = refund.tx_id;
      taskRecord.refundAmount = refund.amount;
      
      await AuditLog.create({
        userId: user._id,
        action: 'Verification Failed & Refunded',
        details: { taskId: taskRecord._id, reason: verification.reason, refundTxId: refund.tx_id, amount: refund.amount },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      });
    }
    await taskRecord.save();

    // 7. Store endpoint usage
    await EndpointUsage.create({
      endpointName: winner_endpoint,
      endpointId: winner_endpoint,
      provider: winner_endpoint.includes('accurate') ? 'GPT-4o' : 'Groq-Llama3',
      responseTime: executionTime,
      cost: price_paid_to_endpoint,
      qualityScore: verification.score,
      userId: user._id,
      taskId: taskRecord._id,
    });

    // 8. Update user totals
    user.totalTasks += 1;
    user.totalSpent += 0.75; // user is charged $0.75
    // Money Saved = traditional enterprise SaaS pricing ($1.50) minus user's routing spend
    user.totalSaved += (1.50 - 0.75); 
    
    // Recalculate total endpoints used
    const userEndpoints = await EndpointUsage.distinct('endpointName', { userId: user._id });
    user.totalEndpointsUsed = userEndpoints.length;
    await user.save();

    // Compute savings_this_request from processedFiles
    let reqRawTokens = 0;
    let reqMapTokens = 0;
    const { encode } = await import('gpt-tokenizer');

    for (const f of processedFiles) {
      reqRawTokens += encode(f.text || '').length;
      reqMapTokens += encode(JSON.stringify(f.semantic_map || {})).length;
    }
    const reqTokensSaved = reqRawTokens - reqMapTokens;
    const reqPercent = reqRawTokens > 0 ? parseFloat(((reqTokensSaved / reqRawTokens) * 100).toFixed(2)) : 0;

    const estimated_raw_cost_usd = parseFloat(((reqRawTokens / 1000) * 0.005 + 1.50).toFixed(2));
    const actual_paid = price_paid_to_endpoint > 0 ? price_paid_to_endpoint : 0.75;
    const savings_multiplier = parseFloat((estimated_raw_cost_usd / actual_paid).toFixed(1));

    const savings_this_request = {
      raw_tokens: reqRawTokens,
      map_tokens: reqMapTokens,
      tokens_saved: reqTokensSaved,
      reduction_percent: reqPercent,
      estimated_usd_saved: parseFloat(((reqTokensSaved / 1000) * 0.0015).toFixed(4)),
      estimated_raw_cost_usd,
      savings_multiplier
    };

    return c.json({
      category,
      winner_endpoint,
      price_paid_to_endpoint,
      verification,
      refund,
      extracted_files: extractedFiles.map((f) => ({ filename: f.filename, method: f.method })),
      savings_this_request,
      result: handlerResult,
    });
  } catch (error: any) {
    console.error('Error in run-task handler:', error);
    if (taskRecord) {
      taskRecord.status = 'failed';
      await taskRecord.save();
    }
    if (user) {
      await AuditLog.create({
        userId: user._id,
        action: 'Task Failed',
        details: { error: error.message },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      });
    }
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
}

