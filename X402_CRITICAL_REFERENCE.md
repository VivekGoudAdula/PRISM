# X402 Critical Code Reference - Quick Lookup Guide

> Fast reference for finding and understanding x402 implementation locations.

## File Organization

```
project-root/
│
├── x402-demo-server/              ← BACKEND
│   ├── index.ts                   ⭐ All x402 server code here
│   ├── .env                       ⭐ AVM_ADDRESS, FACILITATOR_URL
│   ├── package.json               Dependencies: @x402/hono, @x402/core
│   └── README.md                  Full backend documentation
│
├── X402-Usecase/projects/X402-Usecase/  ← FRONTEND
│   ├── src/
│   │   ├── App.tsx                Wallet provider setup
│   │   ├── Home.tsx               Landing page
│   │   ├── components/
│   │   │   ├── Weather.tsx        ⭐ Payment UI component
│   │   │   ├── ConnectWallet.tsx  Wallet connection modal
│   │   │   └── ErrorBoundary.tsx  Error handling
│   │   ├── utils/
│   │   │   ├── weatherApi.ts      ⭐⭐ Core x402 logic - MOST IMPORTANT
│   │   │   └── network/
│   │   │       └── getAlgoClientConfigs.ts
│   │   └── styles/
│   │       └── main.css
│   ├── .env.local                 ⭐ VITE_API_BASE_URL, network config
│   ├── tsconfig.json              ⭐ MUST have moduleResolution: "Bundler"
│   ├── package.json               Dependencies: @x402-avm/*
│   ├── vite.config.ts
│   └── README_X402.md             Full frontend documentation
│
└── X402_IMPLEMENTATION_GUIDE.md   ⭐ This file - Complete technical guide

```

---

## Critical Code Locations

### Backend (Hono Server)

**File:** `x402-demo-server/index.ts`

| Section | Line Range | Purpose | Priority |
|---------|-----------|---------|----------|
| Imports | 1-8 | x402 libraries and Hono setup | CRITICAL |
| ENV validation | 10-18 | Check AVM_ADDRESS and FACILITATOR_URL | CRITICAL |
| Facilitator init | 23-27 | Connect to GoPlausible | CRITICAL |
| x402 server init | 28-30 | Create x402ResourceServer | CRITICAL |
| CORS middleware | 33-56 | **MUST be first**, handle OPTIONS | CRITICAL |
| Logging middleware | 58-65 | Debug logging (optional) | OPTIONAL |
| Payment config | 68-85 | Define which routes require payment | CRITICAL |
| Payment middleware | 87 | Apply payment protection | CRITICAL |
| Weather handler | 89-97 | Only reached after payment verified | HANDLER |
| Health endpoint | 99-101 | Public endpoint (no payment) | PUBLIC |
| 404 handler | 103-106 | Handle unknown routes | HANDLER |
| Server start | 108-110 | Start listening on port | STARTUP |

---

### Frontend (React App)

**File:** `src/utils/weatherApi.ts`

| Section | Line Range | Purpose | Priority |
|---------|-----------|---------|----------|
| Imports | 1-4 | x402 and Algorand libraries | CRITICAL |
| createX402Fetch() | 12-75 | **CORE - Initialize x402 client** | ⭐⭐ CRITICAL |
| └─ x402Client | 14 | Create payment client | CRITICAL |
| └─ x402Signer | 19-70 | **Define transaction signer** | ⭐ CRITICAL |
| └─ signTransactions | 21-65 | **Handle wallet signing** | ⭐ CRITICAL |
| └─ Register scheme | 72 | Register Algorand TestNet | CRITICAL |
| └─ wrapFetchWithPayment | 74 | Wrap fetch with 402 handling | CRITICAL |
| fetchWeatherWithPayment() | 78-102 | Main API wrapper function | CRITICAL |
| formatWeatherData() | 105-107 | Format JSON for display | UTILITY |

---

### Frontend (React Component)

**File:** `src/components/Weather.tsx`

| Section | Line Range | Purpose | Priority |
|---------|-----------|---------|----------|
| useWallet hook | 12 | Get wallet connection | CRITICAL |
| handleRequestWeather | 27-55 | Main payment trigger | HANDLER |
| └─ Create signer | 42-45 | Pass wallet to x402 | CRITICAL |
| └─ Call fetch | 48 | Execute payment flow | CRITICAL |
| UI elements | 57-136 | Display loading/error/success | UI |

---

## Code Snippets by Use Case

### Use Case 1: "How does CORS work?"

**File:** `x402-demo-server/index.ts` (lines 33-56)

```typescript
// ⚠️ CRITICAL: CORS must be FIRST middleware
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*',      // Allow ALL headers
    'Access-Control-Expose-Headers': '*',     // Expose ALL response headers
    'Access-Control-Max-Age': '86400',
  }
  
  // Handle browser preflight (OPTIONS)
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  
  // Add headers to all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.header(key, value)
  })
  
  await next()
})
```

**Why:** Browsers block x402 Payment headers unless CORS allows them.

---

### Use Case 2: "How does x402 middleware protect routes?"

**File:** `x402-demo-server/index.ts` (lines 68-87)

```typescript
// Define payment requirements
const weatherConfig = {
  'GET /weather': {
    accepts: [{
      scheme: 'exact',
      price: '$0.005',
      network: ALGORAND_TESTNET_CAIP2,
      payTo: avmAddress,
      extra: { asset: USDC_TESTNET_ASA_ID },
    }],
    description: 'Weather data access',
  },
}

// Apply protection globally
app.use(paymentMiddleware(weatherConfig, x402Server))

// This handler is ONLY reached after payment verified
app.get('/weather', (c) => {
  console.log('✓✓✓ PAYMENT VERIFIED')
  return c.json({ /* data */ })
})
```

**Why:** paymentMiddleware intercepts requests and returns 402 if no signature.

---

### Use Case 3: "How does the wallet sign transactions?"

**File:** `src/utils/weatherApi.ts` (lines 19-70)

```typescript
// This function is called by x402Client when transactions need signing
const x402Signer: ClientAvmSigner = {
  address: walletSigner.address,
  signTransactions: async (txns: Uint8Array[]) => {
    try {
      // Store originals as fallback
      originalTxns = txns
      
      // Call wallet's signing function
      const walletResult = await walletSigner.signTransactions(txns)
      
      // Handle wallet's response format: [null, signed, ...]
      if (Array.isArray(walletResult)) {
        const result = walletResult.map((item, i) => {
          if (item === null || item === undefined) {
            // Wallet didn't sign → use original unsigned
            return originalTxns[i]
          }
          if (item instanceof Uint8Array) {
            // Already signed
            return item
          }
          if (typeof item === 'string') {
            // Base64 → convert to Uint8Array
            const binaryString = atob(item)
            const bytes = new Uint8Array(binaryString.length)
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j)
            }
            return bytes
          }
          return originalTxns[i]
        })
        return result
      }
      return walletResult
    } catch (error) {
      console.error('signTransactions error:', error)
      throw error
    }
  },
}

// Register the signer with x402Client
client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(x402Signer))

// Return wrapped fetch that handles 402 automatically
return wrapFetchWithPayment(fetch, client)
```

**Why:** x402 needs to call wallet's signing when creating payment transactions.

---

### Use Case 4: "How do I make a payment request?"

**File:** `src/utils/weatherApi.ts` (lines 78-102)

```typescript
// Main function - handles entire payment flow automatically
export async function fetchWeatherWithPayment(
  url: string,
  walletSigner: any,
): Promise<any> {
  try {
    // Create wrapped fetch
    const fetchFn = await createX402Fetch(walletSigner)

    // This single call triggers entire flow:
    // 1. Request → 402 challenge
    // 2. x402 creates transactions
    // 3. Calls wallet to sign (user sees popup)
    // 4. Retries with Payment-Signature header
    // 5. Server validates and returns 200
    const response = await fetchFn(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    console.log('SUCCESS - Weather data:', data)
    return data
  } catch (error) {
    console.error('FAILED:', error)
    if (error instanceof Error) {
      throw new Error(`Weather API: ${error.message}`)
    }
    throw error
  }
}
```

**Why:** This abstraction handles all x402 complexity - call once, get results!

---

### Use Case 5: "How do I add a new paid endpoint?"

**Step 1: Backend - Update config**

**File:** `x402-demo-server/index.ts` (lines 68-85)

```typescript
const weatherConfig = {
  'GET /weather': { /* existing */ },
  'GET /forecast': {  // ← NEW ENDPOINT
    accepts: [{
      scheme: 'exact',
      price: '$0.01',  // Different price
      network: ALGORAND_TESTNET_CAIP2,
      payTo: avmAddress,
      extra: { asset: USDC_TESTNET_ASA_ID },
    }],
    description: 'Weather forecast',
  },
}
```

**Step 2: Backend - Add handler**

**File:** `x402-demo-server/index.ts` (after line 97)

```typescript
app.get('/forecast', (c) => {
  console.log('✓✓✓ PAYMENT VERIFIED - GET /forecast')
  return c.json({
    forecast: { tomorrow: 'rainy' },
  })
})
```

**Step 3: Frontend - Add component/call**

```typescript
const forecast = await fetchWeatherWithPayment(
  'http://localhost:4021/forecast',
  { address, signTransactions }
)
```

---

## Configuration Checklist

### Backend Setup

- [ ] `.env` file created with:
  - `AVM_ADDRESS=YOUR_ALGORAND_ADDRESS`
  - `FACILITATOR_URL=https://facilitator.goplausible.xyz`
  - `PORT=4021`
- [ ] `package.json` has:
  - `@x402/hono`
  - `@x402/core`
  - `@x402/avm/exact/server`
- [ ] `index.ts` has:
  - CORS middleware FIRST (lines 33-56)
  - paymentMiddleware applied (line 87)
  - Handlers after middleware (line 89+)

### Frontend Setup

- [ ] `.env.local` created with:
  - `VITE_ALGOD_SERVER=https://testnet-api.algonode.cloud`
  - `VITE_ALGOD_NETWORK=testnet`
  - `VITE_API_BASE_URL=http://localhost:4021`
- [ ] `tsconfig.json` has:
  - `"moduleResolution": "Bundler"` (NOT "Node")
- [ ] `package.json` has:
  - `@x402-avm/core@^2.6.1`
  - `@x402-avm/avm@^2.6.1`
  - `@x402-avm/fetch@^2.6.1`
  - `@txnlab/use-wallet-react`
- [ ] Wallet:
  - Connected to TestNet
  - Has minimum 0.005 USDC (10458941)

---

## Debug Quick Commands

### Check Backend is Running

```bash
# Test health endpoint (no payment required)
curl http://localhost:4021/health

# Output: {"status":"ok"}
```

### Check Payment Request

```bash
# First request (should return 402)
curl -i http://localhost:4021/weather

# Look for:
# HTTP/1.1 402 Payment Required
# Payment-Response: {...}
```

### Tail Server Logs

```bash
# Watch server console for payment verification
tail -f server-logs.txt

# Look for:
# ✓✓✓ PAYMENT VERIFIED
```

---

## Environment Variables Summary

### Backend (.env)

```env
# Required - Your Algorand TestNet address (receives payments)
AVM_ADDRESS=KJ47QTT3MKRHDCLH35GH3ZS27PTQNFSPVZW7AA5R77YQTWRCATPUSDLIXQ

# Required - Facilitator for payment verification
FACILITATOR_URL=https://facilitator.goplausible.xyz

# Optional - Server port
PORT=4021
```

### Frontend (.env.local)

```env
# Required - AlgoNode TestNet endpoint
VITE_ALGOD_SERVER=https://testnet-api.algonode.cloud

# Required - Network identifier
VITE_ALGOD_NETWORK=testnet

# Required - Backend server URL
VITE_API_BASE_URL=http://localhost:4021

# Optional - Facilitator (same as backend)
VITE_FACILITATOR_URL=https://facilitator.goplausible.xyz
```

---

## Key Constants

```typescript
// Algorand TestNet CAIP-2 Network ID
ALGORAND_TESTNET_CAIP2 = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

// USDC Asset ID on TestNet
USDC_TESTNET_ASA_ID = "10458941"

// Payment scheme (Algorand ECDSA)
SCHEME = "exact"

// Default payment amount (0.005 USDC)
PRICE = "$0.005"

// Frontend ports
VITE_PORT = 5173
API_PORT = 4021

// Transaction timeouts
MAX_TIMEOUT_SECONDS = 300
```

---

## Dependencies by Package

### @x402-avm packages (v2.6.1)

```typescript
// Core x402 protocol
import { x402Client, wrapFetchWithPayment } from '@x402-avm/fetch'
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from '@x402-avm/avm'
import type { ClientAvmSigner } from '@x402-avm/avm'
import { ExactAvmScheme } from '@x402-avm/avm/exact/client'
import { ExactAvmScheme } from '@x402-avm/avm/exact/server'
```

### x402 core packages (Server)

```typescript
import { paymentMiddleware } from '@x402/hono'
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server'
```

### Wallet integration

```typescript
import { useWallet } from '@txnlab/use-wallet-react'
import type { WalletManager } from '@txnlab/use-wallet-react'
```

### Framework

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import React from 'react'
import ReactDOM from 'react-dom/client'
```

---

## Common Mistakes & Fixes

| Mistake | Fix | File |
|---------|-----|------|
| Use Node moduleResolution | Change to "Bundler" | tsconfig.json |
| CORS middleware not first | Move to top of app.ts | index.ts line 33 |
| Filter out null transactions | Keep all, map to originals | weatherApi.ts line 50 |
| Use hono/cors | Use manual CORS | index.ts line 33 |
| Wrong AVM_ADDRESS | Use actual receiver address | .env |
| No USDC in wallet | Add 0.005+ USDC (10458941) | Wallet app |
| v2.12.0 package version | Use v2.6.1 (latest stable) | package.json |
| Missing Payment-Signature | Already handled by @x402-avm | (automatic) |
| Server returns 402 always | Check facilitator, wallet, balance | See debugging |

---

## Log Messages to Look For

### Success Sequence

```
Frontend Console:
  "createX402Fetch: initializing for address RK6K3..."
  "x402Signer.signTransactions: received 2 transaction(s)"
  "Calling wallet.signTransactions..."
  "Wallet returned successfully"
  "Returning 2 transactions"
  "Response status: 200"
  "SUCCESS - Weather data: {...}"

Server Console:
  "✓ x402 Resource Server listening at http://localhost:4021"
  "GET /weather"
  "Response Status: 402"
  "GET /weather"
  "Response Status: 200"
  "✓✓✓ PAYMENT VERIFIED - GET /weather handler reached!"
```

### Error Sequence

```
"Response status: 402"
"Response status: 402"
"FAILED: Error: HTTP 402"
"Weather request error:"

Causes:
- Facilitator offline
- No USDC in wallet
- Wrong receiver address
- Network mismatch (MainNet vs TestNet)
```

---

## Quick Reference Commands

```bash
# Start frontend (localhost:5173)
cd X402-Usecase/projects/X402-Usecase
npm run dev

# Start backend (localhost:4021)
cd x402-demo-server
npx tsx index.ts

# Build frontend
npm run build

# Test health endpoint
curl http://localhost:4021/health

# Get server logs in real-time
npx tsx index.ts | tee server.log

# Clear npm cache (if dependency issues)
npm cache clean --force
npm install

# Reinstall node_modules (fresh start)
rm -rf node_modules package-lock.json
npm install
```

---

## Support Resources

- 📚 [X402_IMPLEMENTATION_GUIDE.md](./X402_IMPLEMENTATION_GUIDE.md) - Complete flow explanation
- 📖 [x402-demo-server/README.md](./x402-demo-server/README.md) - Backend full docs
- 📖 [X402-Usecase/README_X402.md](./X402-Usecase/projects/X402-Usecase/README_X402.md) - Frontend full docs
- 🌐 [x402.money](https://x402.money) - Official specification
- 🔗 [Algorand Developer](https://developer.algorand.org)
- 💼 [GoPlausible](https://goplausible.xyz) - Facilitator service
- 🎯 [use-wallet](https://txnlab.gitbook.io/use-wallet) - Wallet integration docs

---

**Last Updated:** May 18, 2026
**Version:** 1.0
**Status:** Production Ready ✅
