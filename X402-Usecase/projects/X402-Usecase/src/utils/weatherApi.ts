import { x402Client, wrapFetchWithPayment } from '@x402-avm/fetch'
import { ALGORAND_TESTNET_CAIP2 } from '@x402-avm/avm'
import type { ClientAvmSigner } from '@x402-avm/avm'
import { ExactAvmScheme } from '@x402-avm/avm/exact/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttachedFile {
  filename: string;
  content_base64: string;
}

/** Provider candidate returned by /plan-task */
export interface ProviderCandidate {
  endpoint_path: string;
  price: number;
  confidence: number;
  latency_ms: number;
  reputation_score: number;
  score?: number;
}

/**
 * One line in the payment preview breakdown shown before the user approves.
 * Represents the cost for a single execution unit (file) or the platform fee.
 */
export interface PaymentPreviewItem {
  /** 'execution' for a per-file payment line, 'platform_fee' for the platform fee row */
  type: 'execution' | 'platform_fee';
  /** 1-based index (only for type='execution') */
  index?: number;
  /** File name if this represents a file execution */
  filename?: string;
  /** Amount in USDC for this line */
  amount: number;
  /** Human-readable label */
  label: string;
}

/** Full execution plan returned by POST /plan-task */
export interface ExecutionPlan {
  planId: string;
  category: string;
  providerName: string;
  endpointPath: string;
  /** Price per single file / execution unit in USDC */
  unitPrice: number;
  /** Number of files to process */
  executionQuantity: number;
  /** unitPrice × executionQuantity */
  executionCost: number;
  /** Fixed platform fee ($0.75) */
  platformFee: number;
  /** Total to be paid: executionCost + platformFee */
  totalCost: number;
  /** Estimated wall-clock time in seconds */
  estimatedTimeSeconds: number;
  /** Provider's reported confidence/accuracy (0-1) */
  estimatedAccuracy: number;
  candidates: ProviderCandidate[];
  /**
   * Per-file payment preview items, computed client-side from the plan.
   * Populated by buildPaymentPreview() before showing the confirmation modal.
   */
  paymentPreview?: PaymentPreviewItem[];
}

/**
 * One entry in the per-file execution progress log returned by /execute-task.
 * Mirrors the server-side ProgressEntry type.
 */
export interface ExecutionProgressEntry {
  step: number;
  filename?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: string;
}

/** Full response returned by POST /execute-task */
export interface ExecuteTaskResponse {
  planId: string;
  category: string;
  winner_endpoint: string;
  providerName: string;
  unitPrice: number;
  executionQuantity: number;
  executionCost: number;
  platformFee: number;
  totalCost: number;
  executionCount: number;
  executionTime: number;
  verification: { passed: boolean; score: number };
  /**
   * The consolidated x402 transaction ID (single Algorand USDC transfer) that
   * covers the entire batch. Represents the "group payment" in our implementation.
   *
   * NOTE: True Algorand atomic grouped transactions are NOT possible with the current
   * x402 wire protocol (one x-payment header per HTTP request). This single tx covers
   * (executionQuantity × unitPrice + platformFee) in one wallet approval.
   */
  groupTransactionId: string;
  /**
   * Payment mode used for this task. Always 'consolidated' until x402 protocol
   * supports grouped payment payloads.
   */
  paymentMode: 'consolidated' | 'grouped';
  /** Per-file execution progress log, populated step-by-step by the server */
  executionProgressLog: ExecutionProgressEntry[];
  extracted_files: Array<{ filename: string; method: string }>;
  result: any;
}

// ─── Client-side helpers ──────────────────────────────────────────────────────

/**
 * Builds the per-file payment preview breakdown from an ExecutionPlan.
 * Used to render itemised rows in the Execution Summary modal.
 *
 * @param plan     - The execution plan returned by /plan-task
 * @param files    - The attached files (used to get filenames for labels)
 * @returns Array of PaymentPreviewItem, one per file plus one for the platform fee
 */
export function buildPaymentPreview(
  plan: ExecutionPlan,
  files: AttachedFile[],
): PaymentPreviewItem[] {
  const items: PaymentPreviewItem[] = [];

  const fileCount = Math.max(plan.executionQuantity, files.length);

  for (let i = 0; i < fileCount; i++) {
    const filename = files[i]?.filename;
    items.push({
      type: 'execution',
      index: i + 1,
      filename,
      amount: plan.unitPrice,
      label: filename
        ? `#${i + 1} — ${filename}`
        : `Execution #${i + 1}`,
    });
  }

  items.push({
    type: 'platform_fee',
    amount: plan.platformFee,
    label: 'Platform Fee',
  });

  return items;
}

// ─── x402 Fetch Factory ───────────────────────────────────────────────────────

/**
 * Creates a fetch wrapper that automatically handles x402 payment flows.
 *
 * @param walletSigner - Connected wallet signer from use-wallet
 * @returns A fetch function that handles 402 payment challenges
 */
export async function createX402Fetch(walletSigner: any) {
  console.log('createX402Fetch: initializing for address', walletSigner.address)
  const client = new x402Client()

  // Keep a reference to original transactions for null-item handling
  let originalTxns: Uint8Array[] = []

  const x402Signer: ClientAvmSigner = {
    address: walletSigner.address,
    signTransactions: async (txns: Uint8Array[]) => {
      try {
        console.log('x402Signer.signTransactions: received', txns.length, 'transaction(s)')
        originalTxns = txns

        txns.forEach((txn, i) => {
          console.log(`Txn ${i}: ${txn.byteLength} bytes, first 10 bytes:`, Array.from(txn.slice(0, 10)))
        })

        console.log('Calling wallet.signTransactions...')
        const walletResult = await walletSigner.signTransactions(txns)

        console.log('Wallet returned:', typeof walletResult)
        console.log('Is array?', Array.isArray(walletResult))

        if (Array.isArray(walletResult)) {
          walletResult.forEach((item, i) => {
            console.log(`Item ${i}: type=${typeof item}, is null=${item === null}, is Uint8Array=${item instanceof Uint8Array}`)
          })

          const result = walletResult.map((item: any, i: number) => {
            if (item === null || item === undefined) {
              console.log(`Item ${i}: unsigned, using original (${originalTxns[i]?.byteLength} bytes)`)
              return originalTxns[i]
            }
            if (item instanceof Uint8Array) {
              console.log(`Item ${i}: signed (${item.byteLength} bytes)`)
              return item
            }
            if (typeof item === 'string') {
              console.log(`Item ${i}: base64 string`)
              const binaryString = atob(item)
              const bytes = new Uint8Array(binaryString.length)
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j)
              }
              return bytes
            }
            console.log(`Item ${i}: unknown format, using original`)
            return originalTxns[i]
          })

          console.log('Returning', result.length, 'transactions')
          return result
        }

        return walletResult
      } catch (error) {
        console.error('signTransactions error:', error)
        throw error
      }
    },
  }

  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(x402Signer))
  console.log('x402 client registered for TestNet')

  return wrapFetchWithPayment(fetch, client)
}

// ─── Phase 1: Plan Task (no payment) ─────────────────────────────────────────

/**
 * Calls POST /plan-task — a free endpoint that classifies the task,
 * discovers providers, and computes dynamic pricing.
 *
 * @param baseUrl - API base URL (e.g. http://localhost:4021)
 * @param taskDescription - Plain-language task description
 * @param files - Attached files (only metadata sent for planning; base64 not needed for cost calc)
 * @returns ExecutionPlan with planId, pricing breakdown, provider info, and payment preview
 */
export async function planTask(
  baseUrl: string,
  taskDescription: string,
  files: AttachedFile[],
): Promise<ExecutionPlan> {
  const url = `${baseUrl}/plan-task`
  console.log('\n=== planTask START ===')
  console.log('URL:', url)
  console.log('Task:', taskDescription)
  console.log('Files:', files.length)

  const token = localStorage.getItem('prism_access_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task_description: taskDescription,
      // Send file metadata only (filename) for quantity calculation — not base64 content
      files: files.map((f) => ({ filename: f.filename })),
    }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error((errData as any).error || `Plan Task failed: HTTP ${response.status}`)
  }

  const data: ExecutionPlan = await response.json()

  // Attach per-file payment preview computed client-side
  data.paymentPreview = buildPaymentPreview(data, files)

  console.log('SUCCESS — ExecutionPlan:', data)
  return data
}

// ─── Phase 2: Execute Task with x402 Payment ─────────────────────────────────

/**
 * Executes the planned task through the x402 payment flow.
 *
 * Calls POST /execute-task?planId=<id> with the x402 payment client.
 * The server enforces payment of exactly totalCost (quantity × unitPrice + platformFee)
 * computed from the stored plan before executing the provider N times.
 *
 * Payment Architecture Note:
 * ─────────────────────────
 * The x402 protocol enforces a single payment per HTTP request. The user approves
 * ONE wallet popup for a single USDC transfer covering the full totalCost.
 * True Algorand atomic grouped transactions would require a protocol extension.
 *
 * @param baseUrl - API base URL
 * @param planId - Plan ID returned by planTask()
 * @param taskDescription - Original task description
 * @param files - Full files with base64 content for actual execution
 * @param walletSigner - Connected wallet signer from use-wallet
 * @returns ExecuteTaskResponse with combined result, progress log, and transaction metadata
 */
export async function executeTaskWithPayment(
  baseUrl: string,
  planId: string,
  taskDescription: string,
  files: AttachedFile[],
  walletSigner: any,
): Promise<ExecuteTaskResponse> {
  const url = `${baseUrl}/execute-task?planId=${encodeURIComponent(planId)}`
  console.log('\n=== executeTaskWithPayment START ===')
  console.log('URL:', url)
  console.log('Plan ID:', planId)
  console.log('Files:', files.length)

  const fetchFn = await createX402Fetch(walletSigner)

  const token = localStorage.getItem('prism_access_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetchFn(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task_description: taskDescription,
      files,
    }),
  })

  console.log('Response status:', response.status)

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error((errData as any).error || `Execute Task failed: HTTP ${response.status}`)
  }

  const data: ExecuteTaskResponse = await response.json()
  console.log('SUCCESS — Execution result:', data)
  return data
}

// ─── Legacy helpers (kept for backward compatibility) ─────────────────────────

/**
 * @deprecated Use planTask() + executeTaskWithPayment() instead.
 * Kept for backward compatibility with the old single-step flow.
 */
export async function runTaskWithPayment(
  url: string,
  taskDescription: string,
  files: Array<{ filename: string; content_base64: string }>,
  walletSigner: any,
): Promise<any> {
  try {
    console.log('\n=== runTaskWithPayment START (legacy) ===')
    const fetchFn = await createX402Fetch(walletSigner)

    const token = localStorage.getItem('prism_access_token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ task_description: taskDescription, files }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('runTaskWithPayment FAILED:', error)
    if (error instanceof Error) throw new Error(`Run Task API: ${error.message}`)
    throw error
  }
}

/** Fetches weather data with x402 payment handling */
export async function fetchWeatherWithPayment(url: string, walletSigner: any): Promise<any> {
  try {
    const fetchFn = await createX402Fetch(walletSigner)
    const response = await fetchFn(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (error instanceof Error) throw new Error(`Weather API: ${error.message}`)
    throw error
  }
}

/** Formats weather data for display */
export function formatWeatherData(data: any): string {
  if (!data) return 'No data'
  return JSON.stringify(data, null, 2)
}
