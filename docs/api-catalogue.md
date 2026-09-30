# PRISM API Catalogue

All endpoints are hosted at: `https://prism-99h2.onrender.com` (production) or `http://localhost:4021` (local).

Every endpoint below is protected by the x402 payment protocol. Unauthenticated requests return HTTP 402 Payment Required with payment instructions.

---

## Payment-Protected AI Endpoints

### Code Review

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/code-review-fast` | Fast | from $0.012 (workload-tiered) | Bug detection, syntax errors, code quality — fast LLM |
| GET/POST | `/code-review-accurate` | Accurate | from $0.012 (workload-tiered) | Senior-engineer deep review, security audit — high-precision LLM |

**Code review pricing is workload-tiered by file size:**

| Tier | Max Lines | Price (USDC) |
|------|-----------|-------------|
| TINY | 50 | $0.012 |
| SMALL | 150 | $0.036 |
| MEDIUM | 400 | $0.12 |
| LARGE | 800 | $0.30 |
| VERY_LARGE | 1,500 | $0.60 |
| HUGE | Unlimited | $1.08 |

**Input (POST JSON):**
```json
{
  "file_path": "src/index.ts",
  "raw_url": "https://raw.githubusercontent.com/owner/repo/main/src/index.ts",
  "task_description": "Security audit and refactoring review"
}
```

---

### Resume Screening

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/resume-screen-fast` | Fast | $0.12 / file | Fast initial candidate ranking using Llama 3 |
| GET/POST | `/resume-screen-accurate` | Accurate | $0.30 / file | Deep match scoring with reasoning using 70B model |

**Input (POST JSON):**
```json
{
  "resume_url": "https://example.com/resume.pdf",
  "job_description": "Senior Full Stack Engineer"
}
```

---

### Contract Analysis

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/contract-analyze-fast` | Fast | $0.18 / file | Key clause extraction, liabilities, obligations |
| GET/POST | `/contract-analyze-accurate` | Accurate | $0.42 / file | Deep legal risk analysis, anomaly flagging |

**Input (POST JSON):**
```json
{
  "raw_url": "https://example.com/contract.pdf",
  "task_description": "Analyze legal liabilities"
}
```

---

### Invoice Extraction

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/invoice-extract-fast` | Fast | $0.096 / file | Vendor info, totals, due date extraction |
| GET/POST | `/invoice-extract-accurate` | Accurate | $0.24 / file | Full line-item, tax, subtotal structured extraction |

**Input (POST JSON):**
```json
{
  "raw_url": "https://example.com/invoice.pdf"
}
```

---

### SEO Auditing

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/seo-audit-fast` | Fast | $0.12 / page | Rule-based metadata, headings, images, links audit |
| GET/POST | `/seo-audit-accurate` | Accurate | $0.30 / page | Deep LLM-assisted readability, keyword, technical SEO |

**Input (POST JSON):**
```json
{
  "page_url": "https://example.com"
}
```

---

### Media Intelligence — Claim Extract

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/claim-extract-fast` | Fast | $0.08 / request | Fast extraction of verifiable claims from media |
| GET/POST | `/claim-extract-accurate` | Accurate | $0.15 / request | Deep claim extraction with attribution and qualifiers |
| GET/POST | `/claim-extract` | Fast (alias) | $0.08 / request | Alias for claim-extract-fast |

---

### Media Intelligence — Claim Verify

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/claim-verify-fast` | Fast | $0.06 / claim | Fast evidence-based claim verification |
| GET/POST | `/claim-verify-accurate` | Accurate | $0.10 / claim | Deep high-precision claim verification |
| GET/POST | `/claim-verify` | Fast (alias) | $0.06 / claim | Alias for claim-verify-fast |

---

### Media Intelligence — Source Compare

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/source-compare-fast` | Fast | $0.15 / comparison | Cross-source agreement/conflict analysis |
| GET/POST | `/source-compare-accurate` | Accurate | $0.25 / comparison | Deep high-precision cross-source comparison |
| GET/POST | `/source-compare` | Fast (alias) | $0.15 / comparison | Alias for source-compare-fast |

---

### Media Intelligence — News Research

| Method | Route | Tier | Price (USDC) | Description |
|--------|-------|------|-------------|-------------|
| GET/POST | `/news-research-fast` | Fast | $0.25 / operation | Multi-document newsroom brief synthesis |
| GET/POST | `/news-research-accurate` | Accurate | $0.40 / operation | Deep research synthesis with entity mapping |
| GET/POST | `/news-research` | Fast (alias) | $0.25 / operation | Alias for news-research-fast |

---

### AI Task Orchestration

| Method | Route | Auth | Price | Description |
|--------|-------|------|-------|-------------|
| POST | `/classify-task` | None | Free | Classifies a plain-language task into a category |
| POST | `/select-endpoint` | None | Free | Runs bidding/scoring for a task category, returns winner |
| POST | `/plan-task` | Optional | Free | Builds a structured execution plan for a task |
| POST | `/execute-task` | Optional | Dynamic | Executes a planned task; price resolved from plan |
| POST | `/run-task` | JWT | $0.25 base | End-to-end orchestration: classify → plan → execute → verify |

---

## Public / Internal Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Server health check — returns `{ status: 'ok' }` |
| GET | `/info` | Server info, configured network, endpoint list |
| GET | `/savings-summary` | Token usage savings summary |
| POST | `/chat-reply` | Conversational chat completion |

---

## Intelligence Layer Routes (API)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/prompt-tutor` | Evaluates prompt quality and returns improvement tips |
| POST | `/api/data-map` | Generates structured context map from task inputs |
| POST | `/api/semantic-cache` | Cache lookup for semantically similar requests |
| POST | `/api/prompt-optimizer` | Rewrites prompt for optimal execution |
| POST | `/api/auth/login` | User authentication |
| POST | `/api/auth/register` | User registration |
| GET | `/api/analytics` | Usage analytics |

---

## x402 Payment Flow

When calling any payment-protected endpoint without a valid payment header:

```
1. Client sends: POST /code-review-fast (no payment)
2. Server returns: HTTP 402 Payment Required
   {
     "x402Version": 2,
     "accepts": [{
       "scheme": "exact",
       "network": "algorand:mainnet",
       "maxAmountRequired": "120000",  // in microUSDC
       "resource": "https://prism-99h2.onrender.com/code-review-fast",
       "payTo": "<PRISM_AVM_ADDRESS>"
     }]
   }
3. Client creates and signs Algorand USDC transaction via @x402-avm/fetch
4. Client retries with Payment-Signature header containing signed transaction
5. GoPlausible facilitator verifies and broadcasts to Algorand
6. PRISM executes capability and returns 200 + structured result
```

---

## Example: Code Review Request (curl)

```bash
# This will return 402 Payment Required with payment instructions
curl -X POST https://prism-99h2.onrender.com/code-review-fast \
  -H "Content-Type: application/json" \
  -d '{
    "raw_url": "https://raw.githubusercontent.com/owner/repo/main/src/index.ts",
    "file_path": "src/index.ts"
  }'
```

For programmatic payment, use the `@x402-avm/fetch` client with a connected Algorand wallet.
