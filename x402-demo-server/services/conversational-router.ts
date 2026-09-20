import { Task, ITask } from '../models/Task';
import { Conversation } from '../models/Chat';
import { callOpenRouter, FAST_MODEL } from '../handlers/lib/openrouter-client';
import mongoose from 'mongoose';

export interface RouteResult {
  intent: 'TASK' | 'CONVERSATIONAL' | 'UNSUPPORTED';
  taskType?: string | null;
  activeTaskId?: string | null;
  referencedTaskIds: string[];
  isAmbiguous?: boolean;
  clarificationQuestion?: string;
  message: string;
  groundedAnswer?: string;
  source?: {
    type: 'task_history' | 'new_task' | 'unsupported';
    taskId?: string;
    taskIds?: string[];
  };
}

/**
 * Main entry point for context-aware conversational task routing in PRISM.
 */
export async function processConversationalMessage(params: {
  conversationId?: string;
  userId?: string;
  message: string;
  hasFiles?: boolean;
}): Promise<RouteResult> {
  const { conversationId, userId, message, hasFiles = false } = params;
  const lowerMsg = message.toLowerCase().trim();

  // Step 1: Fetch historical tasks for this conversation if conversationId is provided
  let historicalTasks: any[] = [];
  if (conversationId && mongoose.isValidObjectId(conversationId)) {
    try {
      const query: any = { conversationId, status: 'completed' };
      if (userId && mongoose.isValidObjectId(userId)) {
        query.userId = userId;
      }
      historicalTasks = await Task.find(query).sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error('[conversational-router] Error fetching historical tasks:', err);
    }
  }

  // Step 2: Classify Intent
  const intentClass = classifyIntent(lowerMsg, hasFiles, historicalTasks);

  // Step 3: Handle UNSUPPORTED intent
  if (intentClass.intent === 'UNSUPPORTED') {
    return {
      intent: 'UNSUPPORTED',
      referencedTaskIds: [],
      message: "That isn't a capability PRISM currently supports. I can help with code review, repository analysis, resume screening, contract analysis, invoice extraction, SEO auditing, claim extraction, claim verification, source comparison, news research, and other available PRISM capabilities.",
      source: { type: 'unsupported' },
    };
  }

  // Step 4: Handle TASK intent (new task request)
  if (intentClass.intent === 'TASK') {
    return {
      intent: 'TASK',
      taskType: intentClass.taskType || null,
      referencedTaskIds: [],
      message: `Directing to ${intentClass.taskType || 'requested task'}...`,
      source: { type: 'new_task' },
    };
  }

  // Step 5: Handle CONVERSATIONAL intent (follow-up or cross-task question)
  if (historicalTasks.length === 0) {
    // No historical tasks exist in this conversation
    return {
      intent: 'CONVERSATIONAL',
      referencedTaskIds: [],
      message: "I don't have a previous task result in this conversation to reference. Please run a task (such as code review, resume screening, or contract analysis) first!",
      source: { type: 'task_history' },
    };
  }

  // Step 6: Resolve Task Context(s)
  const resolved = resolveTaskContexts(lowerMsg, historicalTasks);

  if (resolved.isAmbiguous) {
    return {
      intent: 'CONVERSATIONAL',
      referencedTaskIds: resolved.matchedTaskIds,
      isAmbiguous: true,
      clarificationQuestion: resolved.clarificationQuestion,
      message: resolved.clarificationQuestion || 'Which task are you referring to?',
      source: { type: 'task_history', taskIds: resolved.matchedTaskIds },
    };
  }

  const selectedTasks = historicalTasks.filter((t) =>
    resolved.matchedTaskIds.includes(t._id.toString())
  );

  // Step 7: Generate Grounded Answer using Stored Task Data
  const groundedAnswer = await generateGroundedAnswer(message, selectedTasks);

  const primaryTaskId = selectedTasks.length > 0 ? selectedTasks[0]._id.toString() : undefined;

  return {
    intent: 'CONVERSATIONAL',
    activeTaskId: primaryTaskId,
    referencedTaskIds: resolved.matchedTaskIds,
    message: groundedAnswer,
    groundedAnswer,
    source: {
      type: 'task_history',
      taskId: primaryTaskId,
      taskIds: resolved.matchedTaskIds,
    },
  };
}

/**
 * Classifies input message into TASK, CONVERSATIONAL, or UNSUPPORTED.
 */
function classifyIntent(
  lowerMsg: string,
  hasFiles: boolean,
  historicalTasks: any[]
): { intent: 'TASK' | 'CONVERSATIONAL' | 'UNSUPPORTED'; taskType?: string } {
  // Check explicit unsupported triggers
  const unsupportedKeywords = [
    'weather', 'temperature', 'forecast', 'recipe', 'cook', 'sports', 'cricket',
    'football', 'nba', 'joke', 'sing', 'movie', 'song', 'flight', 'hotel'
  ];
  if (unsupportedKeywords.some((k) => lowerMsg.includes(k))) {
    return { intent: 'UNSUPPORTED' };
  }

  // If files are attached, check if it's a new task vs explicit follow-up question
  if (hasFiles) {
    const isExplicitFollowUpQuestion =
      lowerMsg.includes('what did you find') || lowerMsg.includes('what were') ||
      lowerMsg.includes('which candidate') || lowerMsg.includes('go back to') ||
      lowerMsg.includes('compare the') || lowerMsg.includes('previous');

    if (!isExplicitFollowUpQuestion) {
      if (lowerMsg.includes('resume') || lowerMsg.includes('candidate') || lowerMsg.includes('cv')) {
        return { intent: 'TASK', taskType: 'resume_screening' };
      }
      if (lowerMsg.includes('contract') || lowerMsg.includes('nda') || lowerMsg.includes('agreement') || lowerMsg.includes('termination')) {
        return { intent: 'TASK', taskType: 'contract_analysis' };
      }
      if (lowerMsg.includes('invoice') || lowerMsg.includes('bill') || lowerMsg.includes('receipt')) {
        return { intent: 'TASK', taskType: 'invoice_extraction' };
      }
      return { intent: 'TASK' };
    }
  }

  // Check explicit Conversational reference phrases
  const conversationalPhrases = [
    'what did you find', 'what were the', 'which candidate', 'why did you flag',
    'what did you say', 'go back to', 'what about the', 'explain the',
    'previous', 'earlier', 'above', 'that review', 'those resumes',
    'the repository', 'the contract', 'the invoice', 'compare the',
    'address the', 'findings', 'who was', 'top candidate', 'first task',
    'security issues', 'authentication', 'payment due'
  ];

  const hasConversationalPhrase = conversationalPhrases.some((p) => lowerMsg.includes(p));

  if (hasConversationalPhrase && historicalTasks.length > 0) {
    return { intent: 'CONVERSATIONAL' };
  }

  // Check for New Task signals
  const hasGitHubUrl = lowerMsg.includes('github.com/');
  const hasSiteUrl = lowerMsg.includes('http://') || lowerMsg.includes('https://') || lowerMsg.includes('www.');

  if (hasGitHubUrl || (lowerMsg.includes('review') && lowerMsg.includes('repository'))) {
    return { intent: 'TASK', taskType: 'code_review' };
  }

  if (hasSiteUrl || lowerMsg.includes('audit website') || lowerMsg.includes('seo audit')) {
    return { intent: 'TASK', taskType: 'seo_audit' };
  }

  if (lowerMsg.startsWith('screen these resumes') || lowerMsg.startsWith('screen resumes')) {
    return { intent: 'TASK', taskType: 'resume_screening' };
  }

  if (lowerMsg.startsWith('analyze this contract') || lowerMsg.startsWith('review this contract') || (lowerMsg.includes('contract') && lowerMsg.includes('termination'))) {
    return { intent: 'TASK', taskType: 'contract_analysis' };
  }

  if (lowerMsg.startsWith('extract invoice') || lowerMsg.startsWith('extract this invoice')) {
    return { intent: 'TASK', taskType: 'invoice_extraction' };
  }

  // If there are historical tasks and the user is asking a question (who/what/which/why/how/can/does)
  const isQuestion =
    lowerMsg.startsWith('what') ||
    lowerMsg.startsWith('which') ||
    lowerMsg.startsWith('who') ||
    lowerMsg.startsWith('why') ||
    lowerMsg.startsWith('how') ||
    lowerMsg.startsWith('can') ||
    lowerMsg.startsWith('does') ||
    lowerMsg.includes('?');

  if (isQuestion && historicalTasks.length > 0) {
    return { intent: 'CONVERSATIONAL' };
  }

  // Fallback check
  if (historicalTasks.length > 0 && !lowerMsg.includes('screen') && !lowerMsg.includes('analyze') && !lowerMsg.includes('review')) {
    return { intent: 'CONVERSATIONAL' };
  }

  return { intent: 'UNSUPPORTED' };
}

/**
 * Resolves context to specific historical Task ID(s).
 * Detects cross-task references and ambiguous references.
 */
function resolveTaskContexts(
  lowerMsg: string,
  historicalTasks: any[]
): { matchedTaskIds: string[]; isAmbiguous: boolean; clarificationQuestion?: string } {
  // Categorize historical tasks
  const repoTasks = historicalTasks.filter((t) => t.category === 'code_review');
  const resumeTasks = historicalTasks.filter((t) => t.category === 'resume_screening');
  const contractTasks = historicalTasks.filter((t) => t.category === 'contract_analysis');
  const invoiceTasks = historicalTasks.filter((t) => t.category === 'invoice_extraction');

  // Check for cross-task signals
  const mentionsRepo = lowerMsg.includes('repo') || lowerMsg.includes('repository') || lowerMsg.includes('code');
  const mentionsResume = lowerMsg.includes('resume') || lowerMsg.includes('candidate') || lowerMsg.includes('applicant');
  const mentionsContract = lowerMsg.includes('contract') || lowerMsg.includes('agreement') || lowerMsg.includes('clause');
  const mentionsInvoice = lowerMsg.includes('invoice') || lowerMsg.includes('bill');

  const mentionedCategories: any[][] = [];
  if (mentionsRepo && repoTasks.length > 0) mentionedCategories.push(repoTasks);
  if (mentionsResume && resumeTasks.length > 0) mentionedCategories.push(resumeTasks);
  if (mentionsContract && contractTasks.length > 0) mentionedCategories.push(contractTasks);
  if (mentionsInvoice && invoiceTasks.length > 0) mentionedCategories.push(invoiceTasks);

  // Cross-task query detected!
  if (mentionedCategories.length >= 2) {
    const matchedTaskIds = mentionedCategories.map((cat) => cat[0]._id.toString());
    return { matchedTaskIds, isAmbiguous: false };
  }

  // Single category reference
  if (mentionsRepo) {
    if (repoTasks.length > 1 && !lowerMsg.includes('first') && !lowerMsg.includes('latest') && !lowerMsg.includes('second')) {
      return {
        matchedTaskIds: repoTasks.map((t) => t._id.toString()),
        isAmbiguous: true,
        clarificationQuestion: `You have multiple repository reviews in this conversation. Which repository review are you referring to?`,
      };
    }
    if (repoTasks.length > 0) return { matchedTaskIds: [repoTasks[0]._id.toString()], isAmbiguous: false };
  }

  if (mentionsResume) {
    if (resumeTasks.length > 1 && !lowerMsg.includes('first') && !lowerMsg.includes('latest')) {
      return {
        matchedTaskIds: resumeTasks.map((t) => t._id.toString()),
        isAmbiguous: true,
        clarificationQuestion: `You have multiple resume screening tasks. Which candidate batch are you referring to?`,
      };
    }
    if (resumeTasks.length > 0) return { matchedTaskIds: [resumeTasks[0]._id.toString()], isAmbiguous: false };
  }

  if (mentionsContract) {
    if (contractTasks.length > 1) {
      return {
        matchedTaskIds: contractTasks.map((t) => t._id.toString()),
        isAmbiguous: true,
        clarificationQuestion: `You have multiple contract analysis tasks. Which contract review are you referring to?`,
      };
    }
    if (contractTasks.length > 0) return { matchedTaskIds: [contractTasks[0]._id.toString()], isAmbiguous: false };
  }

  if (mentionsInvoice) {
    if (invoiceTasks.length > 0) return { matchedTaskIds: [invoiceTasks[0]._id.toString()], isAmbiguous: false };
  }

  // Search by entities / candidate names / topics in stored task outputs
  for (const task of historicalTasks) {
    const outputStr = JSON.stringify(task.output || {}).toLowerCase();
    if (
      (lowerMsg.includes('security') || lowerMsg.includes('authentication')) && task.category === 'code_review'
    ) {
      return { matchedTaskIds: [task._id.toString()], isAmbiguous: false };
    }
    if (
      (lowerMsg.includes('python') || lowerMsg.includes('candidate') || lowerMsg.includes('applicant')) && task.category === 'resume_screening'
    ) {
      return { matchedTaskIds: [task._id.toString()], isAmbiguous: false };
    }
    if (
      (lowerMsg.includes('termination') || lowerMsg.includes('clause')) && task.category === 'contract_analysis'
    ) {
      return { matchedTaskIds: [task._id.toString()], isAmbiguous: false };
    }
  }

  // Default fallback: return most recent completed task
  return { matchedTaskIds: [historicalTasks[0]._id.toString()], isAmbiguous: false };
}

/**
 * Generates grounded answer using OpenRouter or deterministic fallback generator.
 */
async function generateGroundedAnswer(message: string, tasks: any[]): Promise<string> {
  const taskDataSummaries = tasks.map((t) => ({
    taskId: t._id,
    taskType: t.category,
    prompt: t.prompt,
    selectedEndpoint: t.selectedEndpoint,
    output: t.output,
    createdAt: t.createdAt,
  }));

  const systemPrompt = `You are PRISM's intelligent conversational assistant.
Answer the user's question accurately using ONLY the stored task results provided below.

STORED HISTORICAL TASK RESULTS:
${JSON.stringify(taskDataSummaries, null, 2)}

STRICT GROUNDING RULES:
1. Base your answer ONLY on actual data, findings, clauses, candidates, scores, or issues present in the STORED HISTORICAL TASK RESULTS.
2. If the user asks for a detail, candidate, clause, or issue that DOES NOT exist in the stored task results, respond with:
   "I don't have that detail in the stored result."
3. Do NOT fabricate or hallucinate any findings, security issues, candidate names, or contract clauses.
4. Keep your answer concise, direct, clear, and professional.`;

  try {
    const content = await callOpenRouter({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 350,
    });

    if (content && content.trim()) {
      return content.trim();
    }
  } catch (err) {
    // LLM unconfigured or network issue: fall back to deterministic grounded answer generator
  }

  return buildDeterministicGroundedAnswer(message, tasks);
}

/**
 * Deterministic local grounded answer builder using actual stored task output structures.
 */
function buildDeterministicGroundedAnswer(message: string, tasks: any[]): string {
  const lowerMsg = message.toLowerCase();

  // Check if requested detail is missing from stored results
  if (lowerMsg.includes('soc2') || lowerMsg.includes('hipaa') || lowerMsg.includes('gdpr') || lowerMsg.includes('salary')) {
    const allOutputStr = JSON.stringify(tasks.map((t) => t.output || {})).toLowerCase();
    if (!allOutputStr.includes('soc2') && !allOutputStr.includes('hipaa') && !allOutputStr.includes('gdpr')) {
      return "I don't have that detail in the stored result.";
    }
  }

  const parts: string[] = [];

  for (const t of tasks) {
    const category = t.category;
    const output = t.output || {};

    if (category === 'code_review') {
      const files = output.files || [];
      const issues: string[] = [];
      files.forEach((f: any) => {
        (f.issues || []).forEach((iss: any) => {
          issues.push(`${iss.title || iss.description} in ${f.file_path}`);
        });
      });
      if (issues.length > 0) {
        parts.push(`In the repository review (${t.prompt || 'code review'}), security issues found include: ${issues.join('; ')}.`);
      } else {
        parts.push(`In the repository review, overall quality score was ${output.averageQualityScore || 1.0} with no critical issues.`);
      }
    } else if (category === 'resume_screening') {
      const candidates = output.candidates || [];
      const candidateSummaries = candidates.map(
        (c: any) => `${c.name} (Score: ${c.score}, Skills: ${(c.skills || []).join(', ')}, Recommendation: ${c.recommendation})`
      );
      if (candidateSummaries.length > 0) {
        parts.push(`In the resume screening, candidate results: ${candidateSummaries.join('; ')}.`);
      }
    } else if (category === 'contract_analysis') {
      const docs = output.documents || [];
      const clauseSummaries: string[] = [];
      docs.forEach((d: any) => {
        (d.clauses || []).forEach((cl: any) => {
          clauseSummaries.push(`${cl.category || cl.title}: ${cl.text}`);
        });
      });
      if (clauseSummaries.length > 0) {
        parts.push(`In the contract analysis: ${clauseSummaries.join('; ')}.`);
      }
    } else if (category === 'invoice_extraction') {
      parts.push(`In the invoice extraction: Vendor ${output.vendor_name || 'Unknown'}, Total $${output.total_amount || 0}, Date ${output.date || 'Unknown'}.`);
    }
  }

  if (parts.length > 0) {
    if (tasks.length > 1) {
      return `Based on stored task data:\n${parts.join('\n\n')}`;
    }
    return parts.join('\n');
  }

  return "I don't have that detail in the stored result.";
}
