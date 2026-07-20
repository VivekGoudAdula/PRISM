# Prism

**The Verified Bidding Market for AI Agents, Built on x402**

Prism is an AI operations router for small and mid-sized businesses. A business asks for a task in plain language — screen these resumes, analyze this contract, extract these invoices — and Prism routes the request to the right AI capability, pays for it instantly on Algorand via the x402 protocol, verifies the result, and returns one clean answer with one bill.

Built on Algorand TestNet, settled via [x402](https://x402.org), verified through the [GoPlausible](https://goplausible.com) facilitator.

> Submitted for the **Algorand Global x402 Challenge**.

---

## Table of contents

- [The problem](#the-problem)
- [The solution](#the-solution)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [API reference](#api-reference)
- [Demo walkthrough](#demo-walkthrough)
- [Business model](#business-model)
- [Competitive landscape](#competitive-landscape)
- [Roadmap](#roadmap)
- [Acknowledgments](#acknowledgments)

---

## The problem

Small and mid-sized businesses need many narrow AI capabilities — resume screening, contract review, invoice processing — but today's market forces a bad choice:

- **Buy five to ten separate subscriptions**, most of which sit idle most of the month and don't talk to each other.
- **Or stitch together disconnected point solutions manually**, losing hours per task to copy-paste work between tools.

Meanwhile, developers building excellent narrow AI agents have no direct route to paying customers without building their own billing, onboarding, and distribution — as much work as building the model itself.

## The solution

Prism is the router, not the marketplace. A business describes a task once. Behind the scenes:

1. Prism classifies the task into a category.
2. Every qualified endpoint in that category **bids** — price, confidence, and on-chain reputation.
3. Prism selects the best overall bid (not just the cheapest) and pays it instantly via x402.
4. The result is automatically **verified** before the business sees it.
5. The verified outcome updates that endpoint's reputation, which feeds the next bid.

All endpoints at launch are built and owned by Prism — this is what makes every transaction attributable to Prism on the official challenge leaderboard, and what makes genuine bidding possible from day one (a fast/lower-cost version and a slower/higher-accuracy version compete in every category). Third-party endpoints are a planned Phase 2 expansion, not part of the MVP.

## How it works

```
 1. Task intake        →  Business submits a request in plain language
 2. Intent parsing      →  LLM classifies the task into a category
 3. Discovery & bidding →  Qualified endpoints bid: price, confidence, reputation
 4. Scoring & selection →  Best overall bid wins (not just cheapest)
 5. Payment & execution →  x402 settles instantly, endpoint runs the task
 6. Verification        →  Output checked; reputation updates on pass/fail
 7. Synthesis & output   →  One clean answer, one bill, delivered to the business
```

Only steps 2, 6, and 7 require a language model at all — the rest (discovery, scoring, payment-protocol handling) is deterministic backend engineering. This is what makes the system explainable and buildable within a short build window rather than a multi-year research project.

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────────────────┐
│   Frontend (React)   │        │        Backend (Hono + Node)         │
│                       │        │                                      │
│  Wallet connect       │◄──────►│  POST /run-task   (x402-protected)   │
│  Task input + files   │  x402  │    → /classify-task   (internal)     │
│  Result display       │  fetch │    → /select-endpoint (internal)     │
└─────────────────────┘        │    → winning category endpoint       │
                                 │      (x402-protected, 2 per category)│
                                 │    → verify-output + reputation-store│
                                 └──────────────────────────────────────┘
                                              │
                                              ▼
                                  GoPlausible facilitator
                                  Algorand TestNet · USDC ASA
```

Six category endpoints exist at launch — a fast and an accurate version each for resume screening, contract analysis, and invoice extraction — so the bidding step always has real competing options.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Blockchain / settlement | Algorand TestNet (Mainnet at launch) | Low fees, instant finality, native stablecoin support |
| Payment protocol | x402 | HTTP-native, agent-to-agent settlement, no checkout UI |
| Payment facilitator | GoPlausible | Verifies and settles x402 payments |
| Backend | Hono + TypeScript (Node) | Lightweight, fast to iterate on the starter kit's route pattern |
| Frontend | React + Vite + TailwindCSS | Fast dev loop, wallet integration via `@txnlab/use-wallet-react` |
| Wallets | Pera / Defly / Lute | Algorand TestNet wallet support |
| Document extraction | `pdf-parse` + `tesseract.js` (OCR fallback) | Handles both text-layer PDFs and scanned documents |
| LLM orchestration | Provider-agnostic (Groq / Anthropic / OpenAI, whichever key is configured) | Intent classification and result structuring |
| Reputation store | Local JSON store (`data/reputation.json`) at MVP stage | Simple, inspectable, upgradeable to a real database post-hackathon |

## Repository structure

```
x402-demo-server/            Backend (Hono)
├── index.ts                  Server entry point, route registration
├── endpoints.config.ts       Price/network config per x402-protected route
├── handlers/
│   ├── classify-task.ts       Public — LLM task classification
│   ├── select-endpoint.ts     Public — bidding + scoring logic
│   ├── run-task.ts            x402-protected — main customer-facing endpoint
│   ├── resume-screen-fast.ts
│   ├── resume-screen-accurate.ts
│   ├── contract-analyze-fast.ts
│   ├── contract-analyze-accurate.ts
│   ├── invoice-extract-fast.ts
│   ├── invoice-extract-accurate.ts
│   └── lib/
│       ├── extract-document.ts   Shared PDF/OCR text extraction
│       ├── verify-output.ts      Schema-based output verification
│       └── reputation-store.ts   Read/update endpoint reputation
└── data/
    └── reputation.json

X402-Usecase/projects/X402-Usecase/    Frontend (React + Vite)
├── src/
│   ├── components/
│   │   ├── ConnectWallet.tsx
│   │   └── landing/                   Landing page sections
│   ├── utils/
│   │   ├── weatherApi.ts (→ taskApi.ts)  x402 client wrapper
│   │   └── network/getAlgoClientConfigs.ts
│   └── Home.tsx
└── .env.local
```

## Getting started

### Prerequisites

- Node.js 18+
- An Algorand TestNet wallet (Pera, Defly, or Lute) funded with TestNet ALGO and TestNet USDC
- An API key for at least one LLM provider (Groq, Anthropic, or OpenAI)

### Backend setup

```bash
cd x402-demo-server
npm install
```

Create `.env`:

```
AVM_ADDRESS=<your Algorand payout address>
FACILITATOR_URL=<GoPlausible facilitator URL>
PORT=4021
GROQ_API_KEY=<your key>          # or ANTHROPIC_API_KEY / OPENAI_API_KEY
```

```bash
npm start
```

Confirm it's running:

```bash
curl http://localhost:4021/health
```

### Frontend setup

```bash
cd X402-Usecase/projects/X402-Usecase
npm install
```

Create `.env.local`:

```
VITE_ALGOD_SERVER=<Algorand TestNet node URL>
VITE_ALGOD_NETWORK=testnet
VITE_API_BASE_URL=http://localhost:4021
VITE_FACILITATOR_URL=<GoPlausible facilitator URL>
```

```bash
npm run dev
```

Open the app, connect a TestNet wallet funded with TestNet USDC and ALGO (ALGO covers network fees — Pera wallets must opt in to the USDC asset before they can receive or spend it).

## API reference

| Endpoint | Protected | Description |
|---|---|---|
| `GET /health` | No | Server health check |
| `POST /classify-task` | No | Classifies a plain-language task into a category |
| `POST /select-endpoint` | No | Runs bidding/scoring for a given category, returns the winner |
| `POST /run-task` | Yes ($0.75 USDC) | Main entry point: classify → bid → pay → execute → verify |
| `POST /resume-screen-fast` | Yes ($0.20 USDC) | Fast resume screening |
| `POST /resume-screen-accurate` | Yes ($0.45 USDC) | Higher-accuracy resume screening |
| `POST /contract-analyze-fast` | Yes ($0.30 USDC) | Fast contract clause analysis |
| `POST /contract-analyze-accurate` | Yes ($0.60 USDC) | Higher-accuracy contract analysis |
| `POST /invoice-extract-fast` | Yes ($0.15 USDC) | Fast invoice line-item extraction |
| `POST /invoice-extract-accurate` | Yes ($0.35 USDC) | Higher-accuracy invoice extraction |

All protected endpoints follow the x402 flow: an unauthenticated request returns `402 Payment Required` with payment instructions; a signed payment header triggers verification and execution.

## Demo walkthrough

1. Connect a TestNet wallet (funded with TestNet USDC + ALGO).
2. Type a task, e.g. *"Screen this resume for a backend engineer role"*, and attach one or more files.
3. Approve the $0.75 USDC payment prompt.
4. Prism classifies the task, runs bidding between the fast and accurate endpoints for that category, pays the winner, and executes.
5. The result renders with: category, winning endpoint, cost, verification status, and structured output.
6. Reputation for the winning endpoint updates in `data/reputation.json`, influencing future bids.

## Business model

Task price = true upstream endpoint cost + Prism's margin (30–40%), billed per task rather than as a flat subscription. Planned revenue lines beyond task margin: a verified-mode premium tier, and a marketplace take rate once third-party developers can list endpoints through Prism (Phase 2).

## Competitive landscape

- **x402 discovery layers** (Agent402, x402 Bazaar) provide generic endpoint discovery, not a vertical-specific product.
- **AI model aggregators** (Poe, OpenRouter) operate on subscriptions or per-token pricing, not x402-native settlement.
- **SMB AI agent platforms** (Arthur & Co, BILL) sell into the same problem space on flat subscriptions, with no bidding or verification mechanism.

Prism's combination — verified, pay-per-task pricing plus a live bidding market — is not offered by any of the above.

## Roadmap

- **Now (MVP):** 3 task categories, 2 competing endpoints each, simplified bidding and verification, all endpoints Prism-owned.
- **Next:** real inter-service x402 settlement between the router and its endpoints (current MVP uses a direct in-process call as a stand-in), on-chain staking and slashing for endpoint collateral, expanded task categories.
- **Later:** Phase 2 marketplace — third-party developers list endpoints through Prism, reaching Prism's existing customers, with Prism handling discovery, payment, and settlement on their behalf.

## Acknowledgments

Built on top of the [x402-Project](https://github.com/marotipatre/x402-Project) starter kit, using the GoPlausible x402 facilitator on Algorand TestNet.
