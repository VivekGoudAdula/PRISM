# PRISM x402 Protocol Implementation

This document describes how PRISM implements the x402 HTTP payment protocol on Algorand.

---

## What is x402?

x402 is an open HTTP payment protocol that enables pay-per-use API access. Rather than using API keys or subscriptions, x402 allows any HTTP client to pay for access to a resource using a signed blockchain transaction carried in a request header.

When a client hits a protected endpoint without payment, the server returns `HTTP 402 Payment Required` with machine-readable payment instructions. The client creates and signs a payment transaction, attaches it to the retry request, and the server verifies settlement before executing the request.

---

## PRISM's x402 Implementation

### Libraries Used

| Package | Role |
|---------|------|
| `@x402/hono` | Hono middleware that intercepts requests and enforces payment requirements |
| `@x402/core` | Server-side x402 resource server and facilitator client |
| `@x402/avm` | Algorand Virtual Machine implementation of x402 |
| `@x402-avm/extensions` | Bazaar discovery extension for endpoint metadata |
| `@x402-avm/fetch` (frontend) | x402-aware fetch wrapper for client-side payment creation |

### Payment Flow (Exact Implementation)

```
Client
  │
  ├─ POST /code-review-fast (no payment header)
  │
  ↓
Hono Server (index.ts)
  │
  ├─ CORS middleware (first)
  ├─ Logging middleware
  ├─ paymentMiddleware(paymentConfig, x402Server)   ← @x402/hono
  │
  │   [No Payment-Signature header found]
  │
  ├─ Returns HTTP 402 with:
  │   {
  │     "x402Version": 2,
  │     "accepts": [{
  │       "scheme": "exact",
  │       "network": "algorand:mainnet" or "algorand:testnet",
  │       "maxAmountRequired": "120000",        (microUSDC)
  │       "resource": "https://prism-99h2.onrender.com/code-review-fast",
  │       "payTo": "<AVM_ADDRESS>",
  │       "extra": { "asset": 31566704 }        (USDC ASA ID)
  │     }]
  │   }
  │
  ↓
Frontend (@x402-avm/fetch)
  │
  ├─ Parses 402 response
  ├─ Creates Algorand transaction group (setup + USDC axfer)
  ├─ Signs via connected wallet (Pera/Defly/Lute)
  ├─ Encodes as Payment-Signature header
  ├─ Retries POST /code-review-fast + Payment-Signature: eyJ...
  │
  ↓
Hono Server
  │
  ├─ paymentMiddleware extracts Payment-Signature
  ├─ x402Server.onBeforeVerify() hook fires (diagnostic logging)
  │
  ├─ HTTPFacilitatorClient sends to GoPlausible facilitator
  │   POST https://facilitator.goplausible.xyz/verify
  │   { signedTransactions: [...] }
  │
  ↓
GoPlausible Facilitator
  │
  ├─ Verifies ECDSA signatures
  ├─ Checks sender USDC balance
  ├─ Prevents replay attack (txn ID uniqueness check)
  ├─ Broadcasts transaction to Algorand
  ├─ Waits for on-chain confirmation (~4 seconds)
  ├─ Returns { settled: true, transaction: "TXID...", amount: 120000 }
  │
  ↓
Hono Server
  │
  ├─ x402Server.onAfterSettle() hook fires (logs txn ID, amount, endpoint)
  ├─ paymentMiddleware allows request to continue
  ├─ Route handler executes AI capability
  ├─ Returns 200 + structured AI result
  │
  ↓
Client receives result
```

---

## Network Configuration

Controlled by the `NETWORK_MODE` environment variable:

```typescript
// endpoints.config.ts
export const NETWORK_MODE = (process.env.NETWORK_MODE || 'mainnet').toLowerCase();

// TestNet config
caip2: 'algorand:SGO1GKSxyTDd...'   // Algorand TestNet CAIP-2
usdcAssetId: 10458941                // USDC TestNet ASA

// Mainnet config
caip2: 'algorand:wGgZayEzwvG6DPy...' // Algorand Mainnet CAIP-2
usdcAssetId: 31566704                // USDC Mainnet ASA
```

Both networks are registered simultaneously to support both TestNet and Mainnet clients:

```typescript
const avmServerScheme = new ExactAvmScheme();
x402Server.register(ALGORAND_MAINNET_CAIP2, avmServerScheme);
x402Server.register(ALGORAND_TESTNET_CAIP2, avmServerScheme);
```

---

## Dynamic Pricing

PRISM implements two pricing models:

### Static Pricing
Most endpoints use a fixed base price from `pricing.config.ts`.

### Dynamic Pricing (Plan-based)
The `/execute-task` endpoint uses a dynamic price resolver that:

1. Extracts `planId` from the request (query string, header, or body)
2. Looks up the corresponding `Task` document in MongoDB
3. Returns the pre-computed `unitPrice` or per-item price from `itemPrices[]`
4. Falls back to the static base price if no plan is found

```typescript
// endpoints.config.ts — createDynamicPriceResolver()
async (context) => {
  const planId = extractPlanId(context);
  const task = await Task.findById(planId);
  return task?.unitPrice ? `$${task.unitPrice}` : fallbackPrice;
}
```

---

## Bazaar Discovery

PRISM registers with the x402 Bazaar discovery network via `@x402-avm/extensions`:

```typescript
import { bazaarResourceServerExtension } from '@x402-avm/extensions';
x402Server.registerExtension(bazaarResourceServerExtension);
```

Each endpoint includes `declareDiscoveryExtension()` metadata with example inputs/outputs, enabling x402 Bazaar to document PRISM's capabilities automatically.

---

## Canonical Resource URLs

PRISM uses a deterministic resource URL registry (`endpoints.registry.ts`) to ensure payment resource identities are stable across deployments:

```
https://prism-99h2.onrender.com/code-review-fast
https://prism-99h2.onrender.com/resume-screen-fast
...
```

This prevents the facilitator from creating duplicate resource entries when the same endpoint is called from different paths.

---

## Algorand Settlement

- **Settlement asset:** USDC (ASA 31566704 on Mainnet, 10458941 on TestNet)
- **Settlement time:** ~4 seconds (1 Algorand block)
- **Fees:** Algorand network fees (~0.001 ALGO per transaction group, paid by the client)
- **Replay protection:** Enforced by GoPlausible facilitator via transaction ID uniqueness
- **Verification:** `onAfterSettle` hook logs the Algorand transaction ID for every settled payment

---

## Security Notes

- The `AVM_ADDRESS` (payment recipient) is configured server-side only — it is never exposed to the client
- Payment verification is handled entirely by the GoPlausible facilitator — PRISM does not process or hold private keys
- The x402 middleware enforces payment before any AI workload is executed — there is no code path that executes capability logic before a verified payment
