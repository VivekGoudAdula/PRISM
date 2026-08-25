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
 * Helper to fetch all Groq API keys available in environment variables
 */
function getGroqKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  for (let i = 1; i <= 20; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

/**
 * Modular Prompt Tutor Service
 * Analyzes user prompts for clarity, specificity, completeness, constraints, and structure.
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

  // Document Text Extraction (No base64 sent to LLM)
  const fileSummaries: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let text = f.text || '';
    if (!text && f.content_base64) {
      try {
        const ext = await extractText(f.filename || `file-${i + 1}`, f.content_base64);
        text = ext.text || '';
      } catch (err) {
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

  const contextStr = fileSummaries.length > 0 ? `\n\nAttached Files Context:\n${fileSummaries.join('\n')}` : '';
  const fullUserPayload = `${promptText}${contextStr}`;
  const inputTokens = estimateTokens(fullUserPayload);

  const keys = getGroqKeys();
  let analysis: PromptAnalysisResult | null = null;

  if (keys.length > 0) {
    const systemInstruction = `You are Prompt Tutor, an expert AI prompt optimization layer for PRISM.
Your job is to analyze the user's task request BEFORE execution and provide structured feedback to improve prompt engineering.

Evaluate:
1. Clarity & Specificity: Is the request well-defined?
2. Completeness: Are target roles, schemas, or criteria present?
3. Constraints & Expected Output Format: Is the desired output structure specified?
4. Inefficiencies or Redundancies: Are there conflicting or unnecessary instructions?
5. Missing Context: What essential information is lacking?

Scoring rules:
- Score from 0 to 100 based on prompt quality.
- High score (>80): Specific, well-structured, clear role/task, explicit output format.
- Medium score (50-80): Understandable intent but missing evaluation criteria, role details, or output formatting.
- Low score (<50): Vague, single phrase, or missing key parameters.

Do NOT invent fake requirements. Distinguish required missing info from optional recommendations.
The improvedPrompt MUST preserve the user's exact original intent and MUST NOT introduce unsupported facts.
CRITICAL REQUIREMENT: The improvedPrompt MUST preserve all repository links (e.g. GitHub URLs like https://github.com/...), URLs, target names, file names, or specific parameters present in the original prompt. NEVER omit or remove user-provided URLs!

Return ONLY a valid, single JSON object with this exact structure and NO Markdown formatting or markdown wrappers:
{
  "score": number,
  "intent": "short 2-4 word intent summary",
  "taskType": "resume_screening | contract_analysis | invoice_extraction | code_review | general_query",
  "issues": ["list of detected issues"],
  "requiredInformation": ["list of missing required context/details"],
  "irrelevantInformation": ["list of redundant/irrelevant parts, or empty"],
  "constraints": ["key constraints identified"],
  "suggestions": ["actionable recommendations to improve"],
  "improvedPrompt": "full optimized prompt preserving intent and user URLs"
}`;

    try {
      const { groqManager } = await import('../handlers/lib/groq-manager');
      const res = await groqManager.chatCompletion({
        model: 'openai/gpt-oss-20b',
        responseFormatJson: false,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: `Task Request: "${promptText}"${contextStr}` },
        ],
        temperature: 0.1,
      });

      if (res.data || res.rawContent) {
        const rawContent = res.rawContent;
        const parsed = typeof res.data === 'object' && res.data ? res.data : JSON.parse(rawContent);
        const sanitizeStringArray = (val: any): string[] => {
          if (!val) return [];
          if (Array.isArray(val)) {
            return val.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).filter(Boolean);
          }
          if (typeof val === 'string') {
            return [val];
          }
          return [JSON.stringify(val)];
        };

        let improvedPrompt = parsed.improvedPrompt || promptText;
        const urlMatches = promptText.match(/https?:\/\/[^\s]+/g);
        if (urlMatches) {
          for (const url of urlMatches) {
            if (!improvedPrompt.includes(url)) {
              improvedPrompt = `${improvedPrompt} (Repository/Target URL: ${url})`;
            }
          }
        }

        analysis = {
          score: Math.min(100, Math.max(0, Number(parsed.score) || 70)),
          intent: parsed.intent || 'Task analysis',
          taskType: parsed.taskType || hintCategory || 'general_query',
          issues: sanitizeStringArray(parsed.issues),
          requiredInformation: sanitizeStringArray(parsed.requiredInformation),
          irrelevantInformation: sanitizeStringArray(parsed.irrelevantInformation),
          constraints: sanitizeStringArray(parsed.constraints),
          suggestions: sanitizeStringArray(parsed.suggestions),
          improvedPrompt,
          modelUsed: 'openai/gpt-oss-20b',
          originalInputTokens: inputTokens,
        };
      }
    } catch (err) {
      console.warn('Prompt Tutor groqManager analysis failed:', err);
    }
  }

  // Fallback to local rule-based heuristic if LLM API unavailable
  if (!analysis) {
    analysis = generateLocalFallbackAnalysis(promptText, files, hintCategory);
    analysis.originalInputTokens = inputTokens;
  }

  return analysis;
}

/**
 * Rule-based heuristic fallback if LLM is offline/unreachable
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

  if (p.includes('resume') || p.includes('candidate') || p.includes('hiring') || p.includes('cv')) {
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
  if (taskType === 'resume_screening') {
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
