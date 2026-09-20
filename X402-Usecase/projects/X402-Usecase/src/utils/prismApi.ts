

import { api } from './api';
import { x402Client, wrapFetchWithPayment } from '@x402-avm/fetch';
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from '@x402-avm/avm';
import type { ClientAvmSigner } from '@x402-avm/avm';
import { ExactAvmScheme } from '@x402-avm/avm/exact/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttachedFile {
  filename: string;
  content_base64: string;
}

export interface PromptAnalysisResult {
  id?: string;
  score: number;
  intent: string;
  taskType: string;
  issues: string[];
  requiredInformation: string[];
  irrelevantInformation: string[];
  constraints: string[];
  suggestions: string[];
  improvedPrompt: string;
  modelUsed?: string;
}

export interface DataMapNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  category?: string;
  parentId?: string;
  importance: number;
  tokenEstimate: number;
  relevanceScore: number;
  includedInContext: boolean;
  metadata?: any;
}

export interface DataMapEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight: number;
  metadata?: any;
}

export interface DataMapResult {
  id?: string;
  title?: string;
  chatId?: string;
  taskType: string;
  rootNodeId: string;
  nodes: DataMapNode[];
  edges: DataMapEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    relevancePercent: number;
    estimatedContextTokens: number;
    potentiallyIrrelevantTokens: number;
    taskIntent: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
export interface ProviderCandidate {
  endpoint_path: string;
  price: number;
  confidence: number;
  latency_ms: number;
  reputation_score: number;
  score?: number;
}

export interface PaymentPreviewItem {
  type: 'execution' | 'platform_fee';
  index?: number;
  filename?: string;
  amount: number;
  label: string;
}

export interface PromptOptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  originalInputTokens: number;
  optimizedInputTokens: number;
  tokensSaved: number;
  reductionPercentage: number;
  compressionRatio: number;
  preservedEntities: string[];
  preservedRelationships: string[];
  preservedConstraints: string[];
  removedRedundancies: string[];
  removedIrrelevantContext: string[];
  summarizedSections: string[];
  optimizationApplied: boolean;
  modelUsed: string;
  measurementSource: 'provider_usage' | 'estimated' | 'hybrid';
}

export interface DynamicPriceResult {
  basePrice: number;
  originalTokens: number;
  finalTokens: number;
  tokensSaved: number;
  savingsRate: number;
  optimizationDiscount: number;
  finalPrice: number;
  discountFactor: number;
  minPrice: number;
}

export interface ItemPriceInfo {
  index: number;
  name: string;
  complexityTier?: string;
  lineCount?: number;
  fileSizeBytes?: number;
  inputTokens: number;
  originalTokens: number;
  finalTokens: number;
  tokensSaved: number;
  savingsRate: number;
  basePrice: number;
  optimizationDiscount: number;
  finalPrice: number;
}

export interface ExecutionPlan {
  planId: string;
  category: string;
  providerName: string;
  endpointPath: string;
  basePrice?: number;
  unitPrice: number;
  optimizationDiscount?: number;
  savingsRate?: number;
  discountFactor?: number;
  finalPrice?: number;
  dynamicPrice?: DynamicPriceResult;
  itemPrices?: ItemPriceInfo[];
  baseTotal?: number;
  totalOptimizationDiscount?: number;
  finalTotal?: number;
  averageFinalPrice?: number;
  executionQuantity: number;
  executionCost: number;
  platformFee: number;
  totalCost: number;
  estimatedTimeSeconds: number;
  estimatedAccuracy: number;
  candidates: ProviderCandidate[];
  originalInputTokens?: number;
  optimizedInputTokens?: number;
  tokensSaved?: number;
  reductionPercentage?: number;
  cacheTokensSaved?: number;
  optimizerTokensSaved?: number;
  totalTokensSaved?: number;
  optimizationApplied?: boolean;
  optimizedPrompt?: string;
  promptOptimizer?: PromptOptimizationResult;
  semanticCache?: SemanticCacheData;
  capped?: boolean;
  total_files_found?: number;
  cap_message?: string;
  skipped?: number;
  isChat?: boolean;
  reply?: string;
  message?: string;
  uploadedFiles?: Array<{ index: number; filename: string }>;
  files?: any[];
  pages?: any[];
  paymentPreview?: PaymentPreviewItem[];
  selectedProvider?: string;
  routingReason?: string;
  explorationUsed?: boolean;
  eligibleProviders?: string[];
}

export interface ExecutionProgressEntry {
  step: number;
  filename?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: string;
}

export interface TokenAnalytics {
  originalInputTokens: number;
  optimizedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensSaved: number;
  compressionRatio: number;
  estimatedOriginalCost: number;
  optimizedCost: number;
  costSaved: number;
  cacheHit: boolean;
  cacheTokensSaved: number;
  measurementSource: 'provider_usage' | 'estimated' | 'hybrid';
  currency: string;
  rawContextTokens?: number;
  dataMapTokens?: number;
  dataMapTokensSaved?: number;
  cacheInputTokens?: number;
  cachedContextTokens?: number;
  cacheTokensAvoided?: number;
  optimizerInputTokens?: number;
  optimizedContextTokens?: number;
  optimizerTokensSaved?: number;
  finalProviderContextTokens?: number;
  prismTotalTokensSaved?: number;
}

export interface SemanticCacheData {
  /** Whether the cache was hit on this request */
  cacheHit: boolean;
  /** Explicit status string from backend */
  cacheStatus: 'hit' | 'miss' | 'bypass';
  /** 0.0–1.0 cosine + Jaccard similarity score */
  similarity: number;
  /** Tokens in the cached context (reused context size) */
  cachedContextTokens: number;
  /** Tokens avoided = originalContextTokens - cachedContextTokens (only on HIT) */
  cacheTokensSaved: number;
  /** MongoDB _id of the matched SemanticCache entry */
  cacheEntryId?: string;
  /** ISO timestamp when the matched cache entry was last used */
  lastUsedAt?: string;
  /** Whether context was reused from an existing semantic representation */
  contextReused?: boolean;
}

export interface ExecuteTaskResponse {
  planId?: string;
  category: string;
  winner_endpoint?: string;
  providerName?: string;
  unitPrice?: number;
  executionQuantity?: number;
  executionCost?: number;
  platformFee?: number;
  totalCost?: number;
  executionCount?: number;
  executionTime?: number;
  verification?: { passed: boolean; score: number };
  groupTransactionId?: string;
  paymentMode?: 'consolidated' | 'grouped';
  executionProgressLog?: ExecutionProgressEntry[];
  extracted_files?: Array<{ filename: string; method: string }>;
  tokenAnalytics?: TokenAnalytics;
  promptOptimizer?: PromptOptimizationResult & {
    enabled?: boolean;
    applied?: boolean;
    originalTokens?: number;
    optimizedTokens?: number;
    preservationValidated?: boolean;
  };
  semanticCache?: SemanticCacheData;
  savings_this_request?: {
    raw_tokens: number;
    map_tokens?: number;
    optimized_tokens?: number;
    tokens_saved: number;
    reduction_percent: number;
    estimated_usd_saved: number;
    estimated_raw_cost_usd?: number;
    savings_multiplier?: number;
  };
  result: any;
}

// ─── Client-side helpers ──────────────────────────────────────────────────────

export function buildPaymentPreview(
  plan: ExecutionPlan,
  files: AttachedFile[]
): PaymentPreviewItem[] {
  const items: PaymentPreviewItem[] = [];

  const repoFiles = (plan as any).files;
  const sitePages = (plan as any).pages;
  const itemPrices = (plan as any).itemPrices || (plan as any).plannerOutput?.itemPrices || [];

  if (plan.category === 'code_review' && Array.isArray(repoFiles) && repoFiles.length > 0) {
    repoFiles.forEach((f: any, i: number) => {
      const itemPrice = itemPrices[i]?.finalPrice ?? Math.max(0.01, plan.unitPrice - (plan.optimizationDiscount || 0));
      items.push({
        type: 'execution',
        index: i + 1,
        filename: f.path,
        amount: itemPrice,
        label: `#${i + 1} — ${f.path}`,
      });
    });
  } else if (plan.category === 'seo_audit' && Array.isArray(sitePages) && sitePages.length > 0) {
    sitePages.forEach((p: any, i: number) => {
      const itemPrice = itemPrices[i]?.finalPrice ?? Math.max(0.01, plan.unitPrice - (plan.optimizationDiscount || 0));
      items.push({
        type: 'execution',
        index: i + 1,
        filename: p.url,
        amount: itemPrice,
        label: `#${i + 1} — ${p.url}`,
      });
    });
  } else {
    const fileCount = Math.max(plan.executionQuantity, files.length);

    for (let i = 0; i < fileCount; i++) {
      const filename = files[i]?.filename;
      const itemPrice = itemPrices[i]?.finalPrice ?? Math.max(0.01, plan.unitPrice - (plan.optimizationDiscount || 0));
      items.push({
        type: 'execution',
        index: i + 1,
        filename,
        amount: itemPrice,
        label: filename ? `#${i + 1} — ${filename}` : `Execution #${i + 1}`,
      });
    }
  }

  if (plan.platformFee > 0) {
    items.push({
      type: 'platform_fee',
      amount: plan.platformFee,
      label: 'Platform Fee',
    });
  }

  return items;
}

// ─── x402 Fetch Factory ───────────────────────────────────────────────────────

export async function createX402Fetch(walletSigner: any) {
  const client = new x402Client();
  let originalTxns: Uint8Array[] = [];

  const x402Signer: ClientAvmSigner = {
    address: walletSigner.address,
    signTransactions: async (txns: Uint8Array[]) => {
      try {
        originalTxns = txns;
        const walletResult = await walletSigner.signTransactions(txns);

        if (Array.isArray(walletResult)) {
          return walletResult.map((item: any, i: number) => {
            if (item === null || item === undefined) {
              return originalTxns[i];
            }
            if (item instanceof Uint8Array) {
              return item;
            }
            if (typeof item === 'string') {
              const binaryString = atob(item);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              return bytes;
            }
            return originalTxns[i];
          });
        }
        return walletResult;
      } catch (error: any) {
        let errMsg = '';
        try {
          errMsg = typeof error === 'string' ? error : error?.message || JSON.stringify(error) || String(error);
        } catch {
          errMsg = String(error);
        }

        if (
          errMsg.includes('Network mismatch') ||
          errMsg.includes('Confirmation Failed(4100)') ||
          errMsg.includes('4100') ||
          errMsg.toLowerCase().includes('different networks') ||
          (error && typeof error === 'object' && (error.code === 4100 || error.data?.type === 'NETWORK_MISMATCH'))
        ) {
          const isMainnet = (import.meta.env.VITE_ALGOD_NETWORK || 'mainnet').toLowerCase() === 'mainnet';
          const expectedNetwork = isMainnet ? 'Mainnet' : 'Testnet';
          throw new Error(
            `Your Pera Wallet is set to a different network than this app. Open Pera, reconnect, and make sure you select ${expectedNetwork} before approving.`
          );
        }
        throw error;
      }
    },
  };

  const isMainnet = (import.meta.env.VITE_ALGOD_NETWORK || 'mainnet').toLowerCase() === 'mainnet';
  const algodUrl = isMainnet ? 'https://mainnet-api.algonode.cloud' : 'https://testnet-api.algonode.cloud';

  // Register both Mainnet and Testnet CAIP2 networks to support payments across both networks seamlessly
  client.register(ALGORAND_MAINNET_CAIP2, new ExactAvmScheme(x402Signer, { algodUrl: 'https://mainnet-api.algonode.cloud' }));
  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(x402Signer, { algodUrl: 'https://testnet-api.algonode.cloud' }));

  return wrapFetchWithPayment(fetch, client);
}

// ─── Phase 1: Plan Task (no payment) ─────────────────────────────────────────

export async function planTask(
  baseUrl: string,
  taskDescription: string,
  files: AttachedFile[],
  hasPriorTaskResult: boolean = false
): Promise<ExecutionPlan> {
  const url = `${baseUrl}/plan-task`;
  const token = localStorage.getItem('prism_access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task_description: taskDescription,
      files: files.map((f) => ({ filename: f.filename, content_base64: f.content_base64 || '' })),
      has_prior_task_result: hasPriorTaskResult,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as any).error || `Plan Task failed: HTTP ${response.status}`);
  }

  const data: ExecutionPlan = await response.json();
  data.paymentPreview = buildPaymentPreview(data, files);
  return data;
}

// ─── Phase 2: Execute Task with x402 Payment ─────────────────────────────────

export async function executeTaskWithPayment(
  baseUrl: string,
  plan: ExecutionPlan,
  taskDescription: string,
  files: AttachedFile[],
  walletSigner: any,
  onProgress?: (current: number, phase: 'payment' | 'executing' | 'verifying' | 'completed') => void
): Promise<ExecuteTaskResponse> {
  const token = localStorage.getItem('prism_access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isDocumentTask = plan.category !== 'code_review';
  const uploadedFileMeta: Array<{ index: number; filename: string }> = (plan as any).uploadedFiles || [];
  const hasStoredFiles = isDocumentTask && uploadedFileMeta.length > 0;

  const plannedFiles = (plan as any).files || [];
  const plannedPages = (plan as any).pages || [];
  const isMultiSourceTask = plan.category === 'source_comparison' || plan.category === 'news_research';
  let executionCount = plan.executionQuantity > 0 ? plan.executionQuantity : 1;
  if (isMultiSourceTask) {
    executionCount = 1;
  } else if (plan.category === 'code_review' && plannedFiles.length > 0) {
    executionCount = Math.min(plan.executionQuantity, plannedFiles.length);
  } else if (plan.category === 'seo_audit' && plannedPages.length > 0) {
    executionCount = Math.min(plan.executionQuantity, plannedPages.length);
  } else if (hasStoredFiles) {
    executionCount = Math.min(plan.executionQuantity, uploadedFileMeta.length);
  } else if (files.length > 0) {
    executionCount = Math.min(plan.executionQuantity, files.length);
  }

  const handlerResults: any[] = [];
  const transactionIds: string[] = [];
  const skippedFiles: Array<{ index: number; path: string; reason: string }> = [];
  const MAX_CONSECUTIVE_FAILURES = 3;
  let consecutiveFailures = 0;

  try {
    for (let i = 0; i < executionCount; i++) {
      const singleFile = files[i];
      const plannedFile = plannedFiles[i];
      const plannedPage = plannedPages[i];

      if (onProgress) {
        onProgress(i + 1, 'payment');
      }

      let payload: Record<string, unknown>;
      let fileLabel: string;

      if (isMultiSourceTask) {
        payload = { plan_id: plan.planId, task_description: taskDescription, all_files: true, files };
        fileLabel = `${uploadedFileMeta.length || files.length} sources`;
      } else if (plan.category === 'code_review' && plannedFile) {
        payload = { file_path: plannedFile.path, raw_url: plannedFile.raw_url };
        fileLabel = plannedFile.path;
      } else if (plan.category === 'seo_audit' && plannedPage) {
        payload = { page_url: plannedPage.url, task_description: taskDescription };
        fileLabel = plannedPage.url;
      } else if (hasStoredFiles) {
        const fileMeta = uploadedFileMeta[i];
        const actualIndex = typeof fileMeta?.index === 'number' ? fileMeta.index : i;
        payload = { file_index: actualIndex, plan_id: plan.planId, task_description: taskDescription };
        fileLabel = fileMeta?.filename || `file-${actualIndex + 1}`;
      } else {
        payload = { task_description: taskDescription, files: singleFile ? [singleFile] : [] };
        fileLabel = singleFile?.filename || `file-${i + 1}`;
      }

      if (onProgress) {
        onProgress(i + 1, 'executing');
      }

      if (i > 0) {
        await new Promise((r) => setTimeout(r, 3500));
      }

      try {
        let response: Response | null = null;
        let lastErr: any = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (attempt > 1) {
              await new Promise((r) => setTimeout(r, 3500));
            }
            const fileFetchFn = await createX402Fetch(walletSigner);
            const endpointUrl = `${baseUrl}${plan.endpointPath}${plan.endpointPath.includes('?') ? '&' : '?'}planId=${encodeURIComponent(plan.planId)}&fileIndex=${i}`;
            const res = await fileFetchFn(endpointUrl, {
              method: 'POST',
              headers: {
                ...headers,
                'x-plan-id': plan.planId,
                'x-file-index': i.toString(),
              },
              body: JSON.stringify(payload),
            });

            if (res.ok) {
              response = res;
              break;
            } else {
              const errData = await res.json().catch(() => ({}));
              lastErr = new Error(errData.error || `Invocation ${i + 1} failed: HTTP ${res.status}`);
            }
          } catch (err) {
            lastErr = err;
          }
        }

        if (!response || !response.ok) {
          throw lastErr || new Error(`Invocation ${i + 1} failed after retries`);
        }

        const paymentHeader = response.headers.get('x-payment') || response.headers.get('payment-signature');
        if (paymentHeader) {
          transactionIds.push(paymentHeader);
        }

        const result = await response.json();
        handlerResults.push(result);
        consecutiveFailures = 0;
      } catch (fileErr: any) {
        consecutiveFailures++;
        const reason = fileErr?.message || String(fileErr);
        skippedFiles.push({ index: i + 1, path: fileLabel, reason });

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          break;
        }
        continue;
      }
    }

    if (onProgress) {
      onProgress(handlerResults.length || executionCount, 'verifying');
    }

    const executeUrl = `${baseUrl}/execute-task?planId=${encodeURIComponent(plan.planId)}`;
    const saveResponse = await fetch(executeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        results: handlerResults,
        transactionIds,
        skipped_files: skippedFiles,
      }),
    });

    if (!saveResponse.ok) {
      const errData = await saveResponse.json().catch(() => ({}));
      throw new Error(errData.error || `Save task execution failed: HTTP ${saveResponse.status}`);
    }

    const data: ExecuteTaskResponse = await saveResponse.json();

    if (onProgress) {
      onProgress(handlerResults.length || executionCount, 'completed');
    }

    return data;
  } catch (err: any) {
    const executeUrl = `${baseUrl}/execute-task?planId=${encodeURIComponent(plan.planId)}`;
    await fetch(executeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: 'failed',
        error: err.message || 'Execution failed',
      }),
    }).catch(() => {});

    throw err;
  }
}

// ─── Phase 0: Prompt Tutor (client-side Puter.js AI analysis) ────────────────

/**
 * System instruction for Puter.js Prompt Tutor analysis.
 * Mirrors the same schema the backend expects and the PromptTutorModal renders.
 */
const PROMPT_TUTOR_SYSTEM = `You are Prompt Tutor, an expert AI prompt optimization layer for PRISM.
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
  "taskType": "news_research | source_comparison | claim_verification | claim_extraction | resume_screening | contract_analysis | invoice_extraction | code_review | general_query",
  "issues": ["list of detected issues"],
  "requiredInformation": ["list of missing required context/details"],
  "irrelevantInformation": ["list of redundant/irrelevant parts, or empty"],
  "constraints": ["key constraints identified"],
  "suggestions": ["actionable recommendations to improve"],
  "improvedPrompt": "full optimized prompt preserving intent and user URLs"
}`;

/**
 * Calls Puter.js AI (browser-side) to analyze a prompt.
 * Puter.js is loaded as window.puter via <script src="https://js.puter.com/v2/"> in index.html.
 * Falls back to the backend rule-based analysis if Puter.js is unavailable.
 */
async function analyzeWithPuterAI(
  prompt: string,
  category?: string
): Promise<PromptAnalysisResult> {
  const puter = (window as any).puter;

  if (!puter?.ai?.chat) {
    throw new Error('Puter.js not available');
  }

  const userMessage = `Task Request: "${prompt}"${category ? `\nHint category: ${category}` : ''}`;

  // puter.ai.chat returns the assistant message content as a string
  const rawContent: string = await puter.ai.chat(userMessage, {
    model: 'gpt-4o-mini',
    system: PROMPT_TUTOR_SYSTEM,
  });

  // Parse JSON — strip any accidental markdown fences
  const jsonStr = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(jsonStr);

  const sanitizeArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((v: any) => (typeof v === 'string' ? v : JSON.stringify(v))).filter(Boolean);
    if (typeof val === 'string') return [val];
    return [JSON.stringify(val)];
  };

  // Re-inject any URLs the LLM may have dropped from the improved prompt
  let improvedPrompt: string = parsed.improvedPrompt || prompt;
  const urlMatches = prompt.match(/https?:\/\/[^\s]+/g);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (!improvedPrompt.includes(url)) {
        improvedPrompt = `${improvedPrompt} (Repository/Target URL: ${url})`;
      }
    }
  }

  return {
    score: Math.min(100, Math.max(0, Number(parsed.score) || 70)),
    intent: parsed.intent || 'Task analysis',
    taskType: parsed.taskType || category || 'general_query',
    issues: sanitizeArray(parsed.issues),
    requiredInformation: sanitizeArray(parsed.requiredInformation),
    irrelevantInformation: sanitizeArray(parsed.irrelevantInformation),
    constraints: sanitizeArray(parsed.constraints),
    suggestions: sanitizeArray(parsed.suggestions),
    improvedPrompt,
    modelUsed: 'puter/gpt-4o-mini',
  };
}

/**
 * Analyzes a prompt using Puter.js AI in the browser.
 *
 * Architecture:
 *   1. Call window.puter.ai.chat() client-side (free, no backend key needed).
 *   2. Persist the result to the backend for MongoDB storage.
 *   3. If Puter.js fails, fall back to backend rule-based analysis.
 *
 * The backend /api/prompt-tutor/analyze endpoint is used ONLY for persistence
 * — it no longer performs any AI call itself.
 */
export async function analyzePromptWithTutor(
  baseUrl: string,
  taskDescription: string,
  files: AttachedFile[],
  category?: string
): Promise<PromptAnalysisResult> {
  let analysis: PromptAnalysisResult | null = null;

  // Step 1: Try Puter.js client-side AI (primary path)
  try {
    analysis = await analyzeWithPuterAI(taskDescription, category);
  } catch (puterErr) {
    console.warn('[PromptTutor] Puter.js analysis failed, falling back to backend rule-based:', puterErr);
  }

  // Step 2: Fall back to backend rule-based analysis if Puter.js failed
  if (!analysis) {
    try {
      const url = `${baseUrl}/api/prompt-tutor/analyze`;
      const token = localStorage.getItem('prism_access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          originalPrompt: taskDescription,
          files: files.map((f) => ({ filename: f.filename, content_base64: f.content_base64 || '' })),
          category,
        }),
      });

      if (response.ok) {
        analysis = await response.json();
      }
    } catch (backendErr) {
      console.warn('[PromptTutor] Backend fallback also failed:', backendErr);
    }
  }

  // Step 3: Last resort — minimal placeholder so the modal still opens
  if (!analysis) {
    analysis = {
      score: 70,
      intent: 'Task execution',
      taskType: category || 'general_query',
      issues: [],
      requiredInformation: [],
      irrelevantInformation: [],
      constraints: [],
      suggestions: [],
      improvedPrompt: taskDescription,
      modelUsed: 'fallback',
    };
  }

  // Step 4: Persist to backend asynchronously (fire-and-forget, non-blocking)
  // This stores the Puter.js result to MongoDB for analytics without blocking the UI.
  if (analysis.modelUsed !== 'fallback') {
    const url = `${baseUrl}/api/prompt-tutor/analyze`;
    const token = localStorage.getItem('prism_access_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        originalPrompt: taskDescription,
        files: files.map((f) => ({ filename: f.filename })), // no base64 for persistence call
        category,
        // Pass pre-computed analysis so backend skips its own AI call
        preComputedAnalysis: analysis,
      }),
    }).catch(() => {}); // non-blocking, ignore errors
  }

  return analysis;
}


// ─── Phase 0.5: Data Map (Interactive Semantic Graph) ───────────────────────

export async function fetchGeneratedDataMap(
  baseUrl: string,
  promptAnalysis: PromptAnalysisResult,
  originalPrompt: string,
  files: AttachedFile[],
  category?: string,
  taskId?: string,
  chatId?: string
): Promise<DataMapResult> {
  const url = `${baseUrl}/api/data-map/generate`;
  const token = localStorage.getItem('prism_access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      promptAnalysis,
      originalPrompt,
      files: files.map((f) => ({ filename: f.filename, content_base64: f.content_base64 || '' })),
      category,
      taskId,
      chatId,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as any).error || `Data Map generation failed: HTTP ${response.status}`);
  }

  return await response.json();
}

export async function fetchUserDataMaps(baseUrl: string): Promise<DataMapResult[]> {
  const url = `${baseUrl}/api/data-map/user`;
  const token = localStorage.getItem('prism_access_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('Failed to fetch user Data Maps');
  return await response.json();
}

export async function fetchChatDataMap(baseUrl: string, chatId: string): Promise<DataMapResult> {
  const url = `${baseUrl}/api/data-map/chat/${chatId}`;
  const token = localStorage.getItem('prism_access_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('Failed to fetch chat Data Map');
  return await response.json();
}

export async function renameDataMap(baseUrl: string, mapId: string, title: string): Promise<DataMapResult> {
  const url = `${baseUrl}/api/data-map/${mapId}/title`;
  const token = localStorage.getItem('prism_access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Failed to rename Data Map');
  return await response.json();
}

/**
 * Fetches Semantic Cache stats for the user.
 */
export async function fetchSemanticCacheStats(): Promise<any> {
  const { data } = await api.get('/api/semantic-cache/stats');
  return data;
}

/**
 * Checks semantic cache for a given task/prompt.
 */
export async function checkSemanticCache(prompt: string, taskType: string, files: AttachedFile[] = []): Promise<SemanticCacheData> {
  const { data } = await api.post('/api/semantic-cache/check', { prompt, taskType, files });
  return data;
}

/**
 * Fetches saved semantic cache history.
 */
export async function fetchSemanticCacheHistory(): Promise<any[]> {
  const { data } = await api.get('/api/semantic-cache/history');
  return data;
}


