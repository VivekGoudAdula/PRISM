# PRISM — AI Orchestration Platform

<p align="center">

**One Platform. Every AI Task.**

Understand → Optimize → Route → Execute

[![Built for Algorand](https://img.shields.io/badge/Built%20for-Algorand-000000?style=for-the-badge&logo=algorand)](https://algorand.co/)
[![x402](https://img.shields.io/badge/Payments-x402-6C4CF1?style=for-the-badge)](https://dev.algorand.co/resources/x402-on-algorand/)
[![TypeScript](https://img.shields.io/badge/Backend-TypeScript-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)

</p>

<p align="center">
  <b>AI orchestration with pay-per-use execution.</b><br/>
  PRISM understands the task, optimizes the context, routes it to the right AI capability, executes it, and handles payment through x402 with settlement on Algorand.
</p>

---

## What is PRISM?

AI applications today often depend on multiple specialized AI services.

One task may require:

* a code analysis service
* a document extraction model
* a resume screening system
* an SEO analyzer
* a research or verification service
* different AI models for different quality requirements

The problem is not a lack of AI capabilities.

The problem is **connecting the right capability to the right task, at the right cost, with a simple execution and payment layer.**

**PRISM is an AI orchestration platform built to solve that problem.**

Instead of making users discover, configure, and manage individual AI services, PRISM provides a single interface that:

```text
Understand
    ↓
Optimize
    ↓
Route
    ↓
Execute
    ↓
Settle
    ↓
Return Result
```

PRISM exposes specialized AI capabilities as **pay-per-use services protected by x402**, with payment settlement on **Algorand**.

---

## Problem

AI services are increasingly specialized, but using them together remains fragmented.

A typical workflow looks like:

```text
Find an AI service
        ↓
Understand its API
        ↓
Check pricing
        ↓
Prepare the input
        ↓
Choose a model
        ↓
Manage credentials
        ↓
Make the request
        ↓
Handle payment
        ↓
Process the result
```

This becomes difficult when applications need multiple capabilities.

### The core problems

* **Fragmented AI services** — different APIs for different tasks.
* **Model selection complexity** — choosing the appropriate quality/cost tier.
* **Repeated context preparation** — the same task context often needs to be structured repeatedly.
* **Disconnected workflows** — AI capabilities operate independently instead of composing naturally.
* **Payment friction** — pay-per-use AI services need a standardized payment mechanism.
* **Cost inefficiency** — unnecessary tokens and repeated work increase execution costs.

PRISM brings these concerns into one orchestration layer.

---

## Solution

PRISM provides a single AI execution layer between the application and specialized AI capabilities.

```mermaid
flowchart TB
    classDef client fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#F8FAFC
    classDef platform fill:#1E1B4B,stroke:#6366F1,stroke-width:2px,color:#F8FAFC
    classDef intel fill:#3B0764,stroke:#A855F7,stroke-width:2px,color:#F8FAFC
    classDef cap fill:#064E3B,stroke:#10B981,stroke-width:2px,color:#F8FAFC
    classDef pay fill:#831843,stroke:#F43F5E,stroke-width:2px,color:#F8FAFC
    classDef algo fill:#18181B,stroke:#00D2FF,stroke-width:2px,color:#F8FAFC
    classDef output fill:#022C22,stroke:#22C55E,stroke-width:2px,color:#F8FAFC

    USER["User / Application"]:::client
    PRISM["PRISM AI Orchestration Platform"]:::platform

    subgraph INT["Intelligence Layer"]
        UND["Understand"]:::intel
        CTX["Context"]:::intel
        OPT["Optimization"]:::intel
        ROUT["AI Router"]:::intel
    end

    subgraph CAP["Specialized AI Capabilities"]
        CR["Code Review"]:::cap
        RS["Resume Screening"]:::cap
        SEO["SEO Audit"]:::cap
        DOC["Documents Analysis"]:::cap
    end

    PAY["x402 Payment Protocol"]:::pay
    SETTLE["Algorand Settlement Rail"]:::algo
    OUT["Structured Result"]:::output

    USER --> PRISM
    PRISM --> UND
    PRISM --> CTX
    UND --> OPT
    CTX --> OPT
    OPT --> ROUT
    ROUT --> CR
    ROUT --> RS
    ROUT --> SEO
    ROUT --> DOC
    CR --> PAY
    RS --> PAY
    SEO --> PAY
    DOC --> PAY
    PAY --> SETTLE
    SETTLE --> OUT
```

The application does not need to manage every specialized capability independently.

PRISM handles the orchestration.

---

## Core Features

| Feature | Description |
| --- | --- |
| **Task Understanding** | Identifies what the user is actually trying to accomplish. |
| **Prompt Tutor** | Evaluates task prompts and identifies missing context or structure. |
| **Data Map** | Structures task inputs and context for downstream execution. |
| **Semantic Cache** | Reuses compatible prior results where applicable. |
| **Prompt Optimizer** | Converts raw instructions into optimized execution context. |
| **AI Router** | Selects the appropriate capability and model tier. |
| **Code Review** | Analyze repositories and source code for quality and issues. |
| **Resume Screening** | Evaluate candidate resumes against role requirements. |
| **SEO Auditing** | Analyze webpages for SEO-related issues. |
| **Invoice Extraction** | Extract structured information from invoices. |
| **Contract Analysis** | Analyze contracts and extract relevant information. |
| **Media Intelligence** | Extract, verify, compare, and research information from sources. |
| **x402 Payments** | Pay-per-use access to protected AI capabilities. |
| **Algorand Settlement** | Payments settle through Algorand. |

---

## Intelligence Layer

PRISM is more than a collection of AI endpoints.

An orchestration layer sits between the user's request and the final capability.

### Prompt Tutor

Evaluates the quality and completeness of an incoming task.

It can identify:

* unclear instructions
* missing context
* missing output structure
* insufficient task specification

and suggest improvements before execution.

### Data Map

Transforms incoming task information into structured context that can be used by downstream capabilities.

This allows PRISM to reason about:

* task inputs
* entities
* relationships
* requirements
* execution context

### Semantic Cache

Checks whether compatible prior work can be reused before executing another expensive AI operation.

### Prompt Optimizer

Optimizes the task context before model execution.

### AI Router

Selects the appropriate execution path based on the task and configured capability/model tiers.

```text
Raw Task
   │
   ▼
Prompt Tutor
   │
   ▼
Data Map
   │
   ▼
Prompt Optimizer
   │
   ▼
Semantic Cache
   │
   ▼
AI Router
   │
   ▼
Specialized Capability
```

---

## System Architecture

```mermaid
flowchart TB
    classDef topBottom fill:#FDE8D0,stroke:#E59849,stroke-width:1.5px,color:#2D1800;
    classDef purpleBox fill:#DCDCF5,stroke:#8B8BE5,stroke-width:1.5px,color:#1A1A4A;
    classDef cyanBox fill:#BCEBEF,stroke:#46B2BC,stroke-width:1.5px,color:#0A3438;
    classDef greyBlueBox fill:#C4D1DF,stroke:#6B829B,stroke-width:1.5px,color:#142230;
    classDef pinkBox fill:#F9D6D6,stroke:#E07A7A,stroke-width:1.5px,color:#401010;
    classDef capBox fill:#B4E5F5,stroke:#49ADC9,stroke-width:1.5px,color:#0B3542;

    START["<b>USER QUERY ON PRISM / AGENT</b><br/>Text • Code • Resume • PDF • URL • Documents • Task"]:::topBottom
    ORCH["<b>PRISM</b><br/>AI ORCHESTRATION LAYER"]:::purpleBox

    UND["<b>PROMPT / TASK UNDERSTANDING</b><br/><br/>• Prompt Tutor<br/>• Intent Detection<br/>• Task Analysis"]:::cyanBox
    CTX["<b>CONTEXT & DATA INTELLIGENCE</b><br/><br/>• Data Map<br/>• Context Mapping<br/>• Document Context"]:::cyanBox

    OPT["<b>OPTIMIZATION LAYER</b><br/><br/>• Semantic Cache<br/>• Prompt Optimizer<br/>• Token Optimization<br/>• Savings Measurement"]:::greyBlueBox

    ROUT["<b>AI ROUTER</b><br/>Selects the appropriate PRISM endpoint"]:::pinkBox

    CR["<b>CODE REVIEW</b>"]:::capBox
    RS["<b>RESUME SCREENING</b>"]:::capBox
    SEO["<b>SEO AUDIT</b>"]:::capBox
    MI["<b>MEDIA INTELLIGENCE</b>"]:::capBox
    INV["<b>INVOICE EXTRACTION</b>"]:::capBox
    CON["<b>CONTRACT ANALYSIS</b>"]:::capBox

    RESP["<b>ENDPOINT RESPONSE</b><br/><br/>• Analysis<br/>• Structured Data<br/>• Insights<br/>• Claims / Evidence<br/>• Task-Specific Results"]:::pinkBox

    PAY["<b>x402 PAYMENT</b><br/><br/>• Payment Required<br/>• Payment Verification<br/>• Pay-Per-Use Access"]:::cyanBox

    SETTLE["<b>ALGORAND SETTLEMENT</b><br/><br/>• On-Chain Settlement<br/>• Transaction Record<br/>• Payment Finality"]:::purpleBox

    END_RES["<b>USER / APPLICATION<br/>FINAL RESULT</b>"]:::topBottom

    START --> ORCH
    ORCH --> UND
    ORCH --> CTX
    UND --> OPT
    CTX --> OPT
    OPT --> ROUT
    ROUT --> CR
    ROUT --> RS
    ROUT --> SEO
    ROUT --> MI
    ROUT --> INV
    ROUT --> CON
    CR --> RESP
    RS --> RESP
    SEO --> RESP
    MI --> RESP
    INV --> RESP
    CON --> RESP
    RESP --> PAY
    PAY --> SETTLE
    SETTLE --> END_RES
```

PRISM uses x402 as the payment/access mechanism around its paid capabilities.

On Algorand, x402 follows the model where a client requests a resource, the server can return `402 Payment Required`, and a facilitator verifies and settles the payment before the protected resource is returned.

---

## x402 Payment Flow

Every paid PRISM capability is designed around a clear unit of execution.

Examples include:

* one code-review operation
* one resume-screening operation
* one invoice extraction
* one contract analysis
* one claim verification
* one source comparison
* one research operation

The conceptual flow is:

```text
Application
     │
     │ Request AI capability
     ▼
PRISM Endpoint
     │
     │ 402 Payment Required
     ▼
Payment Requirements
     │
     │ USDC
     ▼
GoPlausible Facilitator
     │
     ▼
Algorand
     │
     │ Payment verified / settled
     ▼
PRISM Execution
     │
     ▼
AI Capability
     │
     ▼
Structured Result
```

PRISM uses the x402 implementation for its protected endpoints, with the GoPlausible facilitator handling payment verification and settlement.

The Global x402 Challenge specifically requires participating projects to deploy paid x402 endpoints on Algorand Mainnet and use the GoPlausible facilitator.

---

## Why Algorand?

PRISM uses Algorand as the settlement layer for its x402 payment flow.

This gives the payment layer:

* on-chain settlement
* verifiable transactions
* predictable transaction costs
* fast finality
* USDC-based payment support

The important separation is:

```text
PRISM
  │
  │ Orchestration
  ▼
AI Capabilities
  │
  │ Payment Access
  ▼
x402
  │
  │ Verification / Settlement
  ▼
Algorand
```

PRISM focuses on the **orchestration and AI execution layer**, while Algorand provides the underlying settlement rail.

---

## AI Capabilities

### Engineering

#### Code Review

Analyze source repositories and identify:

* code quality issues
* security concerns
* architectural problems
* maintainability issues
* prioritized findings

---

### Human Resources

#### Resume Screening

Evaluate resumes against role requirements and return structured candidate analysis.

---

### Marketing

#### SEO Auditing

Analyze webpages and identify SEO-related issues and recommendations.

---

### Finance

#### Invoice Extraction

Extract structured information from invoices.

---

### Legal

#### Contract Analysis

Analyze contracts and extract relevant information.

---

### Media Intelligence

PRISM includes multiple media-oriented capabilities:

```text
Claim Extraction
       ↓
Claim Verification
       ↓
Source Comparison
       ↓
News Research
```

These capabilities can be used independently or as part of larger workflows.

---

## How PRISM Works

### 1. Submit a Task

The user provides a natural-language request.

Example:

```text
Review this GitHub repository for security and
code quality issues.
```

### 2. Understand

PRISM analyzes the task and determines what needs to be executed.

### 3. Optimize

The Intelligence Layer structures the task, maps its context, and optimizes execution.

### 4. Route

The AI Router determines the appropriate capability and execution tier.

### 5. Pay

The protected capability is accessed through x402.

### 6. Execute

The specialized AI capability processes the request.

### 7. Settle

The payment is verified and settled through the configured Algorand payment flow.

### 8. Return

PRISM returns a structured result to the user/application.

---

## Product Screens

> Screenshots below should be added from the actual PRISM application. Do not use mock or stock images.

### Landing Page

The PRISM entry point explains the orchestration model and available capabilities.

![PRISM Landing Page](docs/assets/screenshots/landing.png)

### PRISM Console

The main task execution interface.

![PRISM Console](docs/assets/screenshots/dashboard.png)

### Prompt Tutor

Shows how PRISM evaluates and improves an incoming task.

![Prompt Tutor](docs/assets/screenshots/prompt-tutor.png)

### Data Map

Shows the structured context generated by PRISM.

![Data Map](docs/assets/screenshots/data-map.png)

### Execution Summary

Shows capability selection, workload information, optimization and execution details.

![Execution Summary](docs/assets/screenshots/execution-summary.png)

### x402 Payment

Shows the payment and settlement stage.

![x402 Payment](docs/assets/screenshots/payment.png)

### Code Review

Shows the final structured code-review result.

![Code Review](docs/assets/screenshots/code-review-result.png)

### Resume Screening

Shows structured candidate screening.

![Resume Screening](docs/assets/screenshots/resume-screening.png)

---

## Execution Model

PRISM follows a pay-per-use model.

There are no mandatory seat-based subscriptions for individual capability execution.

The basic model is:

```text
Task
  ↓
Capability
  ↓
Execution
  ↓
x402 Payment
  ↓
Result
```

Pricing is capability-specific and defined by the backend endpoint configuration.

See:

[`docs/api-catalogue.md`](docs/api-catalogue.md)

for the current endpoint catalogue and pricing.

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + TypeScript |
| API Framework | Hono |
| AI | Groq / configured LLM providers |
| Database | MongoDB |
| Payments | x402 |
| Facilitator | GoPlausible |
| Settlement | Algorand |
| Discovery | x402 Bazaar integration |
| Deployment | Vercel + Render |

The exact endpoint/model configuration is maintained in the backend source and documentation.

---

## Project Structure

```text
PRISM/
│
├── README.md
├── ARCHITECTURE.md
├── X402_IMPLEMENTATION_GUIDE.md
├── render.yaml
├── vercel.json
│
├── docs/
│   ├── api-catalogue.md
│   ├── development.md
│   ├── intelligence-layer.md
│   ├── x402-protocol.md
│   └── assets/
│       ├── architecture/
│       └── screenshots/
│
├── X402-Usecase/
│   └── projects/
│       └── X402-Usecase/
│           ├── src/
│           ├── public/
│           ├── tests/
│           └── package.json
│
└── x402-demo-server/
    ├── handlers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── services/
    ├── scripts/
    ├── tests/
    ├── public/
    ├── endpoints.config.ts
    ├── endpoints.registry.ts
    ├── pricing.config.ts
    └── index.ts
```

---

## Getting Started

### Prerequisites

* Node.js
* npm
* MongoDB
* Groq API key
* Algorand-compatible payment configuration
* GoPlausible facilitator configuration

Check the project configuration and `.env.example` for the exact environment variables required.

---

### 1. Clone

```bash
git clone https://github.com/VivekGoudAdula/PRISM.git
cd PRISM
```

---

### 2. Configure Backend

```bash
cd x402-demo-server
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Configure the required variables.

Never commit:

```text
.env
.env.mainnet
.env.testnet
.env.*.local
```

---

### 3. Start Backend

```bash
npm run dev
```

---

### 4. Start Frontend

Open another terminal:

```bash
cd X402-Usecase/projects/X402-Usecase
npm install
npm run dev
```

Open the local URL shown by Vite.

For the complete setup and troubleshooting guide:

[`docs/development.md`](docs/development.md)

---

## Testing

Backend validation and tests are located under:

```text
x402-demo-server/tests/
```

Run:

```bash
cd x402-demo-server
npm test
```

or:

```bash
npm run test:all
```

Build the backend:

```bash
npm run build
```

Build the frontend:

```bash
cd X402-Usecase/projects/X402-Usecase
npm run build
```

---

## Documentation

| Document | Purpose |
| --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Complete system architecture |
| [`docs/x402-protocol.md`](docs/x402-protocol.md) | PRISM's x402 implementation |
| [`docs/api-catalogue.md`](docs/api-catalogue.md) | Endpoint catalogue and pricing |
| [`docs/intelligence-layer.md`](docs/intelligence-layer.md) | Intelligence Layer internals |
| [`docs/development.md`](docs/development.md) | Local setup and development |
| [`X402_IMPLEMENTATION_GUIDE.md`](X402_IMPLEMENTATION_GUIDE.md) | x402 implementation reference |

---

## Built for the Global x402 Challenge

PRISM was built for the **Global x402 Challenge by Algorand**, with a focus on turning specialized AI capabilities into composable, pay-per-use services.

The challenge centers on paid x402 endpoints running on Algorand Mainnet, real usage, and settlement through the GoPlausible facilitator.

PRISM explores that model from the **orchestration layer**:

```text
Specialized AI Capabilities
          ↓
      PRISM
          ↓
       x402
          ↓
     GoPlausible
          ↓
       Algorand
```

The result is an AI execution platform where capabilities can be accessed through a standardized pay-per-use mechanism.

---

## Roadmap

### Current

* AI task orchestration
* Specialized AI capabilities
* Prompt intelligence
* Context mapping
* Semantic caching
* Prompt optimization
* AI routing
* x402-protected execution
* Algorand settlement
* Pay-per-use capabilities

### Next

* More specialized AI endpoints
* More composable workflows
* Broader external integrations
* Expanded developer access
* Additional AI capability providers

### Longer Term

PRISM can evolve toward a broader marketplace of composable AI capabilities where applications can discover and consume specialized AI services programmatically.

Future capabilities are subject to implementation and should not be interpreted as currently available functionality.

---

## Security

Never commit:

* API keys
* private keys
* wallet secrets
* database credentials
* JWT secrets
* production environment files

Use `.env.example` as the configuration template.

For security issues, please report them privately rather than publishing credentials or exploit details.

---

## License

See [`LICENSE`](LICENSE).

---

## Built with

**AI orchestration · x402 · Algorand · TypeScript · React · MongoDB**

<p align="center">

**PRISM**

*One Platform. Every AI Task.*

</p>
