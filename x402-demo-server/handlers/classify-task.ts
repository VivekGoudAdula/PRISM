import { config } from 'dotenv';
import type { Context } from 'hono';
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
    } = body;

    if (!task_description || typeof task_description !== 'string') {
      return c.json({ error: 'task_description is required' }, 400);
    }

    // ── Hard Pre-Check: Bypass LLM for clear-cut cases ────────────────────────

    // Case 1: No files attached AND a prior task result exists in conversation
    // → Must be a conversational follow-up about already-returned results.
    if (!has_files && has_prior_task_result) {
      console.log('[classify-task] Pre-check: no files + prior result → conversational');
      return c.json({ category: 'conversational', raw_input: task_description });
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

      // Known task keywords — let LLM classify even without files attached
      const hasTaskKeyword =
        lowerDesc.includes('resume') || lowerDesc.includes('candidate') || lowerDesc.includes('cv') ||
        lowerDesc.includes('hiring') || lowerDesc.includes('screen') ||
        lowerDesc.includes('contract') || lowerDesc.includes('agreement') || lowerDesc.includes('nda') ||
        lowerDesc.includes('clause') || lowerDesc.includes('legal') ||
        lowerDesc.includes('invoice') || lowerDesc.includes('receipt') || lowerDesc.includes('bill') ||
        lowerDesc.includes('extract');

      if (!hasGitHubUrl && !hasCodeReviewIntent && !hasTaskKeyword) {
        // Truly uninterpretable — nothing to process.
        console.log('[classify-task] Pre-check: no files, no prior result, no repo, no task keyword → unsupported');
        return c.json({ category: 'unsupported', raw_input: task_description });
      }
    }

    // ── LLM Classification ───────────────────────────────────────────────────

    const getGroqKeys = () => {
      const keys = [];
      if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
      for (let i = 1; i <= 10; i++) {
        const k = process.env[`GROQ_API_KEY_${i}`];
        if (k) keys.push(k);
      }
      console.log(`getGroqKeys: found ${keys.length} keys in process.env`);
      return keys;
    };

    const keys = getGroqKeys();
    let category = 'unsupported';
    let success = false;

    if (keys.length > 0) {
      for (let index = 0; index < keys.length; index++) {
        const groqApiKey = keys[index];
        try {
          console.log(`Attempting Groq API call with key index ${index + 1}...`);
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content: `Classify the input into exactly one of: resume_screening, contract_analysis, invoice_extraction, code_review, conversational, or unsupported.

Rules & Few-Shot Examples:
- Conversational chat, greetings, questions about Prism, pricing, or small talk MUST be classified as conversational:
  Input: "hi" -> conversational
  Input: "hello" -> conversational
  Input: "what can you do?" -> conversational
  Input: "how does pricing work?" -> conversational
  Input: "who are you?" -> conversational

- Bare category mentions or document screening/analysis tasks (when files or repo URLs are provided):
  Input: "resume" -> resume_screening
  Input: "invoice" -> invoice_extraction
  Input: "contract" -> contract_analysis
  Input: "review this github repo" -> code_review
  Input: "code review https://github.com/owner/repo" -> code_review
  Input: "screen candidates for frontend developer" -> resume_screening
  Input: "review NDA termination clause" -> contract_analysis
  Input: "extract line items from vendor bill" -> invoice_extraction

- Random gibberish or uninterpretable noise MUST be classified as unsupported:
  Input: "asdkfjasdf" -> unsupported
  Input: "123987!@#" -> unsupported

Respond with ONLY the single category string: resume_screening, contract_analysis, invoice_extraction, code_review, conversational, or unsupported.`,
                },
                {
                  role: 'user',
                  content: task_description,
                },
              ],
              temperature: 0,
              max_tokens: 10,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim() || '';
            const normalized = content.toLowerCase();
            if (normalized.includes('conversational')) {
              category = 'conversational';
            } else if (normalized.includes('resume_screening')) {
              category = 'resume_screening';
            } else if (normalized.includes('contract_analysis')) {
              category = 'contract_analysis';
            } else if (normalized.includes('invoice_extraction')) {
              category = 'invoice_extraction';
            } else if (normalized.includes('code_review')) {
              category = 'code_review';
            } else {
              category = 'unsupported';
            }
            success = true;
            console.log(`Successfully classified task with key index ${index + 1}`);
            break;
          } else {
            console.warn(`Groq API key index ${index + 1} failed with status: ${response.status}`);
          }
        } catch (e) {
          console.error(`Error with Groq API key index ${index + 1}:`, e);
        }
      }
    }

    if (!success) {
      console.warn('All Groq API keys failed or none provided. Falling back to local classification.');
      category = localClassify(task_description);
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
    desc.includes('frontend') || desc.includes('fullstack') || desc.includes('full-stack')
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
