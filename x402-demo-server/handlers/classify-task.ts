import { config } from 'dotenv';
import type { Context } from 'hono';
import { callOpenRouter, FAST_MODEL } from './lib/openrouter-client';
config();

/**
 * POST /classify-task
 * Classifies a user's task description into a specific category.
 *
 * Accepts optional context fields to short-circuit classification:
 *   - has_files:             true if the user attached files to this message
 *   - has_prior_task_result: true if a completed task exists in the current conversation
 *
 * Hard pre-check rules (evaluated BEFORE any LLM call):
 *   1. No files + prior result  => conversational (follow-up question about existing output)
 *   2. No files + no prior result => unsupported (nothing to screen yet)
 *   3. Files present            => route to LLM for task-type classification as normal
 */
export async function handleClassifyTaskRequest(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const {
      task_description,
      has_files = false,
      has_prior_task_result = false,
      conversationId,
      conversation_id,
    } = body;
    const targetConversationId = conversationId || conversation_id;

    if (!task_description || typeof task_description !== 'string') {
      return c.json({ error: 'task_description is required' }, 400);
    }

    // Check through conversational router service if context is available
    if (targetConversationId || has_prior_task_result) {
      const { processConversationalMessage } = await import('../services/conversational-router');
      const routeRes = await processConversationalMessage({
        conversationId: targetConversationId,
        message: task_description,
        hasFiles: has_files,
      });

      if (routeRes.intent === 'CONVERSATIONAL') {
        console.log('[classify-task] Router matched CONVERSATIONAL intent');
        return c.json({ category: 'conversational', raw_input: task_description, routeResult: routeRes });
      } else if (routeRes.intent === 'UNSUPPORTED') {
        console.log('[classify-task] Router matched UNSUPPORTED intent');
        return c.json({ category: 'unsupported', raw_input: task_description });
      } else if (routeRes.intent === 'TASK' && routeRes.taskType) {
        console.log(`[classify-task] Router matched TASK intent: ${routeRes.taskType}`);
        return c.json({ category: routeRes.taskType, raw_input: task_description });
      }
    }

    // Case 2: No files attached AND no prior result
    // → Check for conversational intent or GitHub repo URL/code review intent.
    if (!has_files && !has_prior_task_result) {
      const lowerDesc = task_description.toLowerCase().trim();
      const isConversationalIntent =
        lowerDesc === 'hi' ||
        lowerDesc === 'hello' ||
        lowerDesc === 'hey' ||
        lowerDesc.startsWith('what can you') ||
        lowerDesc.startsWith('how does') ||
        lowerDesc.startsWith('who are you') ||
        lowerDesc.includes('pricing') ||
        lowerDesc.includes('how much') ||
        lowerDesc.includes('what is prism') ||
        lowerDesc.includes('help');

      if (isConversationalIntent) {
        console.log('[classify-task] Pre-check: conversational greeting/question → conversational');
        return c.json({ category: 'conversational', raw_input: task_description });
      }

      const hasGitHubUrl = lowerDesc.includes('github.com/');
      const hasCodeReviewIntent = lowerDesc.includes('review') || lowerDesc.includes('repo') || lowerDesc.includes('code');
      const hasSiteUrl = lowerDesc.includes('http://') || lowerDesc.includes('https://') || lowerDesc.includes('www.');
      const hasSeoIntent = lowerDesc.includes('seo') || lowerDesc.includes('audit') || lowerDesc.includes('site') || lowerDesc.includes('website');

      // Known task keywords — let LLM classify even without files attached
      const hasTaskKeyword =
        lowerDesc.includes('claim') || lowerDesc.includes('article') || lowerDesc.includes('press release') ||
        lowerDesc.includes('transcript') || lowerDesc.includes('statement') || lowerDesc.includes('media') ||
        lowerDesc.includes('resume') || lowerDesc.includes('candidate') || lowerDesc.includes('cv') ||
        lowerDesc.includes('hiring') || lowerDesc.includes('screen') ||
        lowerDesc.includes('contract') || lowerDesc.includes('agreement') || lowerDesc.includes('nda') ||
        lowerDesc.includes('clause') || lowerDesc.includes('legal') ||
        lowerDesc.includes('invoice') || lowerDesc.includes('receipt') || lowerDesc.includes('bill') ||
        lowerDesc.includes('extract') ||
        (hasSiteUrl || hasSeoIntent);

      if (!hasGitHubUrl && !hasCodeReviewIntent && !hasTaskKeyword) {
        // Truly uninterpretable — nothing to process.
        console.log('[classify-task] Pre-check: no files, no prior result, no repo, no task keyword → unsupported');
        return c.json({ category: 'unsupported', raw_input: task_description });
      }
    }

    // ── Pre-check 1: Fast Deterministic Local Classification (Skip AI if confident) ──
    const fastCategory = localClassify(task_description);
    if (fastCategory !== 'unsupported') {
      console.log(`[classify-task] Deterministic local match found: '${fastCategory}' (Skipped AI call)`);
      return c.json({ category: fastCategory, raw_input: task_description });
    }

    // ── LLM Classification via OpenRouter for ambiguous inputs ───────────────
    let category = 'unsupported';
    try {
      const openRouterContent = await callOpenRouter({
        model: FAST_MODEL,
        messages: [
          {
            role: 'system',
            content: `Classify the input into exactly one of: news_research, source_comparison, claim_verification, claim_extraction, resume_screening, contract_analysis, invoice_extraction, code_review, seo_audit, conversational, or unsupported.

Respond with ONLY the single category string: news_research, source_comparison, claim_verification, claim_extraction, resume_screening, contract_analysis, invoice_extraction, code_review, seo_audit, conversational, or unsupported.`,
          },
          {
            role: 'user',
            content: task_description,
          },
        ],
        temperature: 0,
        max_tokens: 10,
      });

      const normalized = openRouterContent.toLowerCase().trim();
      if (normalized.includes('conversational')) {
        category = 'conversational';
      } else if (normalized.includes('news_research') || normalized.includes('news research') || normalized.includes('research brief')) {
        category = 'news_research';
      } else if (normalized.includes('source_comparison') || normalized.includes('source compare') || normalized.includes('compare sources')) {
        category = 'source_comparison';
      } else if (normalized.includes('claim_verification') || normalized.includes('claim verify') || normalized.includes('verify claim')) {
        category = 'claim_verification';
      } else if (normalized.includes('claim_extraction') || normalized.includes('claim extraction') || normalized.includes('claim')) {
        category = 'claim_extraction';
      } else if (normalized.includes('resume_screening') || normalized.includes('resume screening') || normalized.includes('resume')) {
        category = 'resume_screening';
      } else if (normalized.includes('contract_analysis') || normalized.includes('contract analysis') || normalized.includes('contract')) {
        category = 'contract_analysis';
      } else if (normalized.includes('invoice_extraction') || normalized.includes('invoice extraction') || normalized.includes('invoice')) {
        category = 'invoice_extraction';
      } else if (normalized.includes('code_review') || normalized.includes('code review') || normalized.includes('code')) {
        category = 'code_review';
      } else if (normalized.includes('seo_audit') || normalized.includes('seo audit') || normalized.includes('seo')) {
        category = 'seo_audit';
      } else {
        category = 'unsupported';
      }
      console.log(`[classify-task] OpenRouter classified task as '${category}'`);
    } catch (err) {
      console.warn('[classify-task] OpenRouter classification failed, using local safety fallbacks:', err);
    }

    // Safety net: If files are attached and category is still unsupported, run intent-driven local fallback
    if (category === 'unsupported' && has_files) {
      const localMatched = localClassify(task_description);
      if (localMatched !== 'unsupported') {
        category = localMatched;
      } else {
        const lower = task_description.toLowerCase();
        if (lower.includes('research') || lower.includes('article') || lower.includes('news') || lower.includes('journalism')) {
          category = 'news_research';
        } else if (lower.includes('contract') || lower.includes('nda') || lower.includes('agreement')) {
          category = 'contract_analysis';
        } else if (lower.includes('invoice') || lower.includes('bill') || lower.includes('receipt')) {
          category = 'invoice_extraction';
        } else if (lower.includes('code') || lower.includes('repo') || lower.includes('review')) {
          category = 'code_review';
        } else if (lower.includes('seo') || lower.includes('audit') || lower.includes('website') || lower.includes('site')) {
          category = 'seo_audit';
        } else if (lower.includes('resume') || lower.includes('cv') || lower.includes('candidate') || lower.includes('applicant') || lower.includes('hiring') || lower.includes('engineer') || lower.includes('developer')) {
          category = 'resume_screening';
        } else {
          // General document task fallback
          category = 'news_research';
        }
      }
      console.log(`[classify-task] File-attached safety fallback applied: category = '${category}'`);
    }

    return c.json({
      category,
      raw_input: task_description,
    });
  } catch (error) {
    console.error('Error in classify-task handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

/**
 * Fallback classification method if LLM API is not available.
 * Checks for keyword signals across all supported categories.
 */
function localClassify(description: string): string {
  const desc = description.toLowerCase().trim();

  // Conversational greetings / small talk
  if (
    desc === 'hi' || desc === 'hello' || desc === 'hey' ||
    desc.includes('what can you do') ||
    desc.includes('how does pricing work') ||
    desc.includes('who are you')
  ) {
    return 'conversational';
  }

  // News Research (media & journalism orchestrator)
  if (
    desc.includes('news-research') ||
    desc.includes('news research') ||
    desc.includes('research brief') ||
    desc.includes('newsroom research') ||
    desc.includes('media research') ||
    desc.includes('research workspace') ||
    desc.includes('multi-document research') ||
    desc.includes('research this article') ||
    desc.includes('research these sources') ||
    desc.includes('research this story') ||
    desc.includes('analyze these news sources') ||
    desc.includes('journalist research') ||
    (desc.includes('research') && (desc.includes('article') || desc.includes('source') || desc.includes('story') || desc.includes('claims') || desc.includes('entities') || desc.includes('verification')))
  ) {
    return 'news_research';
  }

  // Source comparison (media & journalism)
  if (
    desc.includes('source-compare') ||
    desc.includes('compare sources') ||
    desc.includes('source comparison') ||
    desc.includes('cross-source') ||
    desc.includes('cross source') ||
    desc.includes('compare multiple sources') ||
    desc.includes('compare these articles') ||
    desc.includes('compare these sources') ||
    desc.includes('find conflicting claims') ||
    desc.includes('find agreements and conflicts')
  ) {
    return 'source_comparison';
  }

  // Claim verification (media & journalism)
  if (
    desc.includes('claim-verify') ||
    desc.includes('verify claim') ||
    desc.includes('claim verification') ||
    desc.includes('verify this claim') ||
    desc.includes('evidence verification') ||
    desc.includes('verify factual claim') ||
    desc.includes('verify this claim using the supplied evidence') ||
    desc.includes('fact-check the provided sources')
  ) {
    return 'claim_verification';
  }

  // Claim extraction (media & journalism)
  if (
    desc.includes('claim-extract') ||
    desc.includes('extract claims') ||
    desc.includes('extract all factual claims') ||
    desc.includes('extract factual claims') ||
    desc.includes('atomic claims') ||
    desc.includes('press release') ||
    desc.includes('interview transcript') ||
    desc.includes('article claims') ||
    desc.includes('verifiable claims') ||
    desc.includes('extract all factual claims from this article') ||
    (desc.includes('extract') && (desc.includes('claim') || desc.includes('article') || desc.includes('factual') || desc.includes('news')))
  ) {
    return 'claim_extraction';
  }

  // SEO Audit check
  if (
    desc.includes('seo') ||
    desc.includes('audit our website') ||
    desc.includes('check our site') ||
    (desc.includes('website') && desc.includes('audit')) ||
    (desc.includes('site') && desc.includes('seo'))
  ) {
    return 'seo_audit';
  }

  // Code review — check before resume because "review" appears in both
  if (desc.includes('github.com/') || desc.includes('code review') ||
    (desc.includes('repo') && desc.includes('review'))) {
    return 'code_review';
  }

  // Resume screening — broad set of keywords
  if (
    desc.includes('resume') || desc.includes('resum') || desc.includes('cv') ||
    desc.includes('candidate') || desc.includes('hiring') ||
    desc.includes('screen') || desc.includes('applicant') ||
    desc.includes('job') || desc.includes('role') || desc.includes('developer') ||
    desc.includes('engineer') || desc.includes('qualification') ||
    desc.includes('recommendation') || desc.includes('backend') ||
    desc.includes('frontend') || desc.includes('fullstack') || desc.includes('full-stack') ||
    desc.includes('profile') || desc.includes('rank') || desc.includes('suitability') ||
    desc.includes('soft skills') || desc.includes('technical skills')
  ) {
    return 'resume_screening';
  }

  // Contract / legal
  if (
    desc.includes('contract') || desc.includes('agreement') || desc.includes('nda') ||
    desc.includes('clause') || desc.includes('legal') || desc.includes('termination') ||
    desc.includes('liability') || desc.includes('indemnif')
  ) {
    return 'contract_analysis';
  }

  // Invoice / billing
  if (
    desc.includes('invoice') || desc.includes('receipt') || desc.includes('bill') ||
    desc.includes('extract invoice') || desc.includes('vendor') ||
    desc.includes('line item') || desc.includes('payment due')
  ) {
    return 'invoice_extraction';
  }

  return 'unsupported';
}
