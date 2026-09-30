# PRISM — Local Development Setup

This guide explains how to clone and run PRISM locally from scratch.

---

## Prerequisites

### Required
| Dependency | Version | Notes |
|------------|---------|-------|
| Node.js | ≥ 20.0 (frontend), ≥ 18.0 (backend) | Check `engines` in each `package.json` |
| npm | ≥ 9.0 | |
| MongoDB | Any recent version | Local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier |
| Groq API Key | — | Get from [console.groq.com/keys](https://console.groq.com/keys) — free tier available |

### Algorand (for payment testing)
| Dependency | Notes |
|------------|-------|
| Algorand wallet | Pera, Defly, or Lute — TestNet or Mainnet |
| USDC on wallet | TestNet USDC (ASA 10458941) or Mainnet USDC (ASA 31566704) |
| AVM address | The wallet address that will receive USDC payments |

### Optional (strongly recommended for Code Review)
| Dependency | Notes |
|------------|-------|
| GitHub Personal Access Token | Raises GitHub API limit from 60 to 5,000 req/hr |

---

## Repository Structure

```
PRISM/
├── README.md                         # Main entry point
├── ARCHITECTURE.md                   # System architecture
├── X402_IMPLEMENTATION_GUIDE.md      # x402 protocol reference
├── render.yaml                       # Render.com backend deployment
├── vercel.json                       # Vercel frontend deployment
├── docs/                             # Technical documentation
│   ├── api-catalogue.md
│   ├── development.md                # This file
│   ├── intelligence-layer.md
│   └── x402-protocol.md
├── X402-Usecase/
│   └── projects/
│       └── X402-Usecase/             # React frontend (Vite)
│           ├── src/
│           ├── tests/
│           └── package.json
└── x402-demo-server/                 # Hono backend (Node.js)
    ├── handlers/                     # Capability handlers
    ├── routes/                       # API routes
    ├── services/                     # Intelligence layer services
    ├── models/                       # MongoDB schemas
    ├── middleware/                   # Auth, rate limiting
    ├── tests/                        # Test scripts
    ├── scripts/                      # Utility scripts
    └── package.json
```

---

## Backend Setup

```bash
cd x402-demo-server
npm install
```

### Environment Configuration

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: Algorand wallet address receiving USDC payments
AVM_ADDRESS=YOUR_ALGORAND_WALLET_ADDRESS

# Required: GoPlausible facilitator URL
FACILITATOR_URL=https://facilitator.goplausible.xyz

# Required: Network mode (testnet or mainnet)
NETWORK_MODE=testnet

# Required: MongoDB connection
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=prism_app

# Required: Groq AI (primary LLM provider)
# You can supply up to 3 keys for rotation/failover
GROQ_API_KEY_1=gsk_your_groq_key_here
# GROQ_API_KEY_2=
# GROQ_API_KEY_3=

# Required: JWT authentication
JWT_SECRET=your_random_long_secret_string_here
JWT_REFRESH_SECRET=another_random_long_secret_string_here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d

# Optional: Server port (default: 4021)
PORT=4021

# Optional but recommended: GitHub API token for code review
# GITHUB_TOKEN=ghp_your_token_here
```

### Start Backend

```bash
npm run dev       # Development mode (auto-reload with tsx)
# or
npm run build && npm start    # Production mode
```

### Verify Backend is Running

```bash
curl http://localhost:4021/health
# Expected: {"status":"ok",...}

curl http://localhost:4021/info
# Expected: {"service":"PRISM x402 Resource Server","x402Network":"TESTNET",...}
```

---

## Frontend Setup

```bash
cd X402-Usecase/projects/X402-Usecase
npm install
```

### Environment Configuration

Create `.env.local`:

```env
# Backend API URL
VITE_API_BASE_URL=http://localhost:4021

# Algorand network configuration
VITE_ALGOD_SERVER=https://testnet-api.algonode.cloud
VITE_ALGOD_NETWORK=testnet

# GoPlausible facilitator URL (same as backend)
VITE_FACILITATOR_URL=https://facilitator.goplausible.xyz
```

### Start Frontend

```bash
npm run dev
```

Frontend will be available at: `http://localhost:5173`

---

## Wallet Setup for Testing

1. Install [Pera Wallet](https://perawallet.app/) or [Defly Wallet](https://defly.app/)
2. Switch to **Algorand TestNet**
3. Fund with TestNet ALGO via [Algorand TestNet Dispenser](https://dispenser.testnet.aws.algodev.network/)
4. Opt into USDC ASA (TestNet Asset ID: `10458941`)
5. Get TestNet USDC — some community dispensers or swap services provide this

---

## Running Tests

All backend test scripts are in `x402-demo-server/tests/`. They are standalone TypeScript scripts runnable with tsx:

```bash
cd x402-demo-server

# Test Groq integration
npx tsx tests/test-groq-integration.ts

# Test claim extraction
npx tsx tests/test-claim-extract.ts

# Test semantic cache
npx tsx tests/test-semantic-cache.ts

# Test dynamic pricing
npx tsx tests/test-dynamic-pricing.ts

# Validate wallet configuration
npx tsx scripts/validate-wallet.ts
```

Each test script requires the `.env` to be configured.

---

## Common Issues & Troubleshooting

### Backend fails to start: Missing environment variables

```
❌ Missing required environment variables:
   - AVM_ADDRESS (your Algorand wallet receiving payments)
   - FACILITATOR_URL (x402 facilitator service)
```

**Fix:** Ensure `.env` contains valid `AVM_ADDRESS` and `FACILITATOR_URL`.

---

### MongoDB connection error

```
❌ MongoDB connection error
```

**Fix:** Ensure MongoDB is running locally:
```bash
mongod --dbpath /your/data/path
```
Or use MongoDB Atlas and update `MONGO_URI` with your Atlas connection string.

---

### 402 always returns (payment never completes)

- Check wallet is connected and on the correct network
- Verify USDC balance > 0
- Verify `AVM_ADDRESS` in `.env` matches your wallet's receiving address
- Check browser console for detailed error messages

---

### CORS error in browser

- Ensure backend is running on port `4021`
- Ensure `VITE_API_BASE_URL=http://localhost:4021` in frontend `.env.local`
- Restart backend after any environment changes

---

### Groq API errors

```
⚠ Groq AI Service initialization warning
```

**Fix:** Verify `GROQ_API_KEY_1` is set and valid. Test with:
```bash
npx tsx tests/test-groq-integration.ts
```

---

## Port Reference

| Service | Default Port | Config |
|---------|-------------|--------|
| Backend API | 4021 | `PORT` in `.env` |
| Frontend | 5173 | Vite default |
| MongoDB | 27017 | `MONGO_URI` in `.env` |

---

## Production Deployment

### Backend (Render.com)

Backend is configured in `render.yaml`:
- Root dir: `x402-demo-server`
- Build: `npm run build`
- Start: `npm start`
- Node version: 20

Set all environment variables in Render dashboard. Never commit `.env` files.

### Frontend (Vercel)

Root `vercel.json` configures SPA routing.
- Frontend path: `X402-Usecase/projects/X402-Usecase`
- Build command: `npm run build`
- Output dir: `dist`

Set `VITE_API_BASE_URL` to your Render backend URL in Vercel environment variables.
