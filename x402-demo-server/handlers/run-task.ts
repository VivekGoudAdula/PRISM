import type { Context } from 'hono';
import { handleClassifyTaskRequest } from './classify-task';
import { handleSelectEndpointRequest } from './select-endpoint';
import { handleResumeScreenFastRequest } from './resume-screen-fast';
import { handleResumeScreenAccurateRequest } from './resume-screen-accurate';
import { handleContractAnalyzeFastRequest } from './contract-analyze-fast';
import { handleContractAnalyzeAccurateRequest } from './contract-analyze-accurate';
import { handleInvoiceExtractFastRequest } from './invoice-extract-fast';
import { handleInvoiceExtractAccurateRequest } from './invoice-extract-accurate';
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
        action: 'Task Failed',
        details: { taskId: taskRecord._id, error: 'Task classification failed or unsupported' },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      });
      return c.json({
        error: 'Task classification failed or unsupported task type',
        details: classifyResult
      }, 400);
    }

    const category = classifyResult.category;
    taskRecord.category = category;
    taskRecord.plannerOutput = classifyResult;
    await taskRecord.save();

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
        json: async () => ({ task_description, files: extractedFiles }),
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

    taskRecord.verificationScore = verification.score;
    taskRecord.verificationStatus = verification.passed ? 'passed' : 'failed';
    await taskRecord.save();

    if (!verification.passed) {
      await AuditLog.create({
        userId: user._id,
        action: 'Verification Failed',
        details: { taskId: taskRecord._id, score: verification.score },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      });
    }

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

    return c.json({
      category,
      winner_endpoint,
      price_paid_to_endpoint,
      verification,
      extracted_files: extractedFiles.map((f) => ({ filename: f.filename, method: f.method })),
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

