import { config } from 'dotenv';
import { extractText } from '../handlers/lib/extract-document';
import { estimateTokens } from './tokenAnalytics';

config();

export interface AttachedFileInput {
  filename: string;
  content_base64?: string;
  text?: string;
}

export interface PromptAnalysisResult {
  score: number;
  intent: string;
  taskType: string;
  issues: string[];
  requiredInformation: string[];
  irrelevantInformation: string[];
  constraints: string[];
  suggestions: string[];
  improvedPrompt: string;
  modelUsed: string;
  originalInputTokens?: number;
}

/**
 * Modular Prompt Tutor Service.
 *
 * Analyzes user prompts for clarity, specificity, completeness, constraints,
 * and structure using a deterministic rule-based engine.
 *
 * NOTE: This service intentionally does NOT call any external LLM (OpenRouter,
 * Puter, etc.). Puter.js is a browser-only SDK and must not be invoked from
 * Node.js / Render. The rule-based engine is fast, zero-latency, and sufficient
 * for pre-execution prompt quality scoring.
 */
export async function analyzePromptWithLLM(
  originalPrompt: string,
  files: AttachedFileInput[] = [],
  hintCategory?: string
): Promise<PromptAnalysisResult> {
  const promptText = (originalPrompt || '').trim();

  // Edge case: Empty or missing prompt
  if (!promptText && files.length === 0) {
    return {
      score: 15,
      intent: 'Unspecified task',
      taskType: 'unsupported',
      issues: ['Task description is empty', 'No context or files provided'],
      requiredInformation: ['Clear explanation of what you need Prism to execute'],
      irrelevantInformation: [],
      constraints: [],
      suggestions: ['Provide a task description or upload documents to analyze.'],
      improvedPrompt: 'Please specify the task you would like Prism to process.',
      modelUsed: 'rule-based-fallback',
      originalInputTokens: 0,
    };
  }

  // Document Text Extraction — build file summaries for scoring
  const fileSummaries: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let text = f.text || '';
    if (!text && f.content_base64) {
      try {
        const ext = await extractText(f.filename || `file-${i + 1}`, f.content_base64);
        text = ext.text || '';
      } catch (_err) {
        text = '';
      }
    }
    const snippet = text.slice(0, 800).trim();
    if (snippet) {
      fileSummaries.push(`File "${f.filename}": ${snippet}`);
    } else {
      fileSummaries.push(`File "${f.filename}" (attached)`);
    }
  }

  const contextStr =
    fileSummaries.length > 0
      ? `\n\nAttached Files Context:\n${fileSummaries.join('\n')}`
      : '';
  const fullUserPayload = `${promptText}${contextStr}`;
  const inputTokens = estimateTokens(fullUserPayload);

  // Use deterministic rule-based analysis — no external AI dependency
  const analysis = generateLocalFallbackAnalysis(promptText, files, hintCategory);
  analysis.originalInputTokens = inputTokens;

  return analysis;
}

/**
 * Rule-based heuristic prompt analysis engine.
 *
 * Classifies task type, scores prompt quality, identifies issues, and
 * generates an improved prompt — all deterministically, with zero latency
 * and no external dependencies.
 */
function generateLocalFallbackAnalysis(
  prompt: string,
  files: AttachedFileInput[],
  hintCategory?: string
): PromptAnalysisResult {
  const p = prompt.toLowerCase().trim();
  const wordCount = p.split(/\s+/).filter(Boolean).length;
  const hasFiles = files.length > 0;

  let taskType = hintCategory || 'general_query';
  let intent = 'General query processing';

  if (
    p.includes('news-research') || p.includes('news research') || p.includes('research this article') ||
    p.includes('research brief') || p.includes('research these sources') || p.includes('research article') ||
    p.includes('journalist research') || p.includes('media research')
  ) {
    taskType = 'news_research';
    intent = 'Multi-source news & journalism research synthesis';
  } else if (
    p.includes('source-compare') || p.includes('compare sources') || p.includes('compare these articles') ||
    p.includes('source comparison') || p.includes('cross-source')
  ) {
    taskType = 'source_comparison';
    intent = 'Cross-source comparison and conflict identification';
  } else if (
    p.includes('claim-verify') || p.includes('verify claim') || p.includes('verify this claim') ||
    p.includes('evidence verification') || p.includes('verify claim using supplied evidence')
  ) {
    taskType = 'claim_verification';
    intent = 'Evidence-based factual claim verification';
  } else if (
    p.includes('claim-extract') || p.includes('extract claims') || p.includes('extract all factual claims') ||
    p.includes('extract key factual claims') || p.includes('factual claims') || p.includes('atomic claims') ||
    p.includes('verifiable factual claims') || p.includes('verifiable claims') || p.includes('claims from this news article') ||
    (p.includes('extract') && (p.includes('claim') || p.includes('article') || p.includes('factual') || p.includes('news')))
  ) {
    taskType = 'claim_extraction';
    intent = 'Factual claim extraction & structuring';
  } else if (p.includes('resume') || p.includes('candidate') || p.includes('hiring') || p.includes('cv') || p.includes('screen candidate')) {
    taskType = 'resume_screening';
    intent = 'Resume screening & candidate evaluation';
  } else if (p.includes('contract') || p.includes('nda') || p.includes('clause') || p.includes('legal')) {
    taskType = 'contract_analysis';
    intent = 'Contract risk & clause review';
  } else if (p.includes('invoice') || p.includes('receipt') || p.includes('bill')) {
    taskType = 'invoice_extraction';
    intent = 'Invoice data & line item extraction';
  } else if (p.includes('code') || p.includes('repo') || p.includes('github') || p.includes('review') || p.includes('http')) {
    taskType = 'code_review';
    intent = 'Automated code review & security check';
  }

  const issues: string[] = [];
  const requiredInformation: string[] = [];
  const suggestions: string[] = [];

  if (wordCount < 6) {
    issues.push('Prompt is very brief and underspecified');
    suggestions.push('Add specific target role, domain context, or instructions');
  }
  if (!p.includes('format') && !p.includes('rank') && !p.includes('return') && !p.includes('structure')) {
    issues.push('Expected output structure or ranking criteria missing');
    requiredInformation.push('Output format / schema guidelines');
    suggestions.push('Define output structure (e.g. key details, ratings, recommendations)');
  }
  if (taskType === 'resume_screening' && !p.includes('skill') && !p.includes('experience')) {
    issues.push('Evaluation criteria & required technical skills missing');
    requiredInformation.push('Target role requirements and weighting criteria');
    suggestions.push('Specify key technical skills, experience range, and match metrics');
  }

  let score = 85;
  if (issues.length === 1) score = 72;
  if (issues.length >= 2) score = 58;
  if (wordCount < 4 && !hasFiles) score = 40;

  const urlMatches = prompt.match(/https?:\/\/[^\s]+/g);
  const repoOrUrlStr = urlMatches ? urlMatches.join(' ') : prompt;

  let improvedPrompt = prompt;
  if (taskType === 'claim_extraction') {
    improvedPrompt = `Extract all independently verifiable factual claims from the provided document (${prompt}). Preserve exact figures, dates, and attribution.`;
  } else if (taskType === 'claim_verification') {
    improvedPrompt = `Verify the factual claim (${prompt}) using the provided evidence documents. Identify supporting evidence, contradicting evidence, and conflicts.`;
  } else if (taskType === 'source_comparison') {
    improvedPrompt = `Compare the provided sources (${prompt}) to identify agreements, conflicting claims, and information gaps.`;
  } else if (taskType === 'news_research') {
    improvedPrompt = `Synthesize multi-source news research (${prompt}) into an executive summary, key findings, and factual verification queue.`;
  } else if (taskType === 'resume_screening') {
    improvedPrompt = `Screen the uploaded resumes for the specified role (${prompt}). Evaluate candidates based on relevant technical skills, years of experience, programming ability, and key projects. Rank candidates and return candidate name, match score, strengths, missing skills, and recommendation.`;
  } else if (taskType === 'code_review') {
    improvedPrompt = `Perform a comprehensive code review on the repository ${repoOrUrlStr}. Evaluate code quality, detect potential bugs, check security vulnerabilities, and recommend actionable fixes with estimated line numbers.`;
  } else if (taskType === 'contract_analysis') {
    improvedPrompt = `Analyze the uploaded legal contract (${prompt}). Extract key clauses, classify risk levels (High/Medium/Low), summarize key terms, and provide risk mitigation recommendations for flagged clauses.`;
  } else if (taskType === 'invoice_extraction') {
    improvedPrompt = `Extract vendor information, invoice number, date, total amount, and itemized line items (description, quantity, unit price, total) from the document (${prompt}).`;
  } else if (issues.length > 0) {
    improvedPrompt = `${prompt}. Please analyze thoroughly, structure the response clearly, and outline key findings, actionable takeaways, and recommendations.`;
  }

  return {
    score,
    intent,
    taskType,
    issues,
    requiredInformation,
    irrelevantInformation: [],
    constraints: [],
    suggestions,
    improvedPrompt,
    modelUsed: 'rule-based-fallback',
  };
}
