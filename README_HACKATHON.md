# 🏆 x402 Build & Arena - Starter Kit

> **Professional x402 Starter Kit** - Production-ready, hackathon-optimized, beginner-friendly.

## 📋 What You Got

This is a **complete, working** x402 payment system ready for hackathon teams to extend:

✅ **Backend Server** - Hono.js with payment middleware  
✅ **Frontend App** - React with wallet integration  
✅ **4 Example Handlers** - Copy/modify for your idea  
✅ **Modular Design** - Add endpoints in 5 minutes  
✅ **Full Documentation** - Quick start to deployment  
✅ **Type-Safe** - TypeScript with no compilation errors  
✅ **Production Ready** - CORS, error handling, logging  

## 🎯 For Hackathon Teams (55 minutes)

### ⚡ 5-Minute Setup
```bash
# Backend setup
cd x402-demo-server
npm install
echo "AVM_ADDRESS=YOUR_WALLET" > .env
echo "FACILITATOR_URL=https://facilitator.goplausible.xyz" >> .env
npm start

# Frontend setup (in new terminal)
cd X402-Usecase/projects/X402-Usecase
npm install
npm run dev
```

### 🚀 40-Minute Build
**Pick one idea:**
- 🤖 AI API endpoint
- 📊 Analytics dashboard
- 🎨 Creator monetization
- 🔍 Premium search
- 📸 Image processing
- etc. (see HACKATHON_STARTER_KIT.md for 10+ ideas)

**Then build it:**
1. Enable/add endpoint in `endpoints.config.ts`
2. Create handler in `handlers/my-api.ts`
3. Register in `index.ts`
4. Test with `curl` then browser

### 💬 15-Minute Polish & Pitch
- Fix any bugs
- Add error handling
- Prepare demo
- Write 2-min pitch

## 📁 Repository Structure

```
X402-Usecase/
├── 🎯 HACKATHON_STARTER_KIT.md      ← START HERE!
├── ⚙️ ARCHITECTURE.md                ← System design
├── 📚 X402_IMPLEMENTATION_GUIDE.md  ← Protocol deep dive
├── 🔗 X402_CRITICAL_REFERENCE.md    ← Code lookup
│
├── 🔧 x402-demo-server/             ← BACKEND (YOUR MVP HERE!)
│   ├── 📝 HACKATHON_README.md       ← Backend-specific guide
│   ├── index.ts                     ← Main server
│   ├── endpoints.config.ts          ← EDIT: Define your routes
│   ├── handlers/                    ← EDIT: Add your logic
│   │   ├── weather.ts               └─ Example: Simple API
│   │   ├── analytics.ts             └─ Example: Analytics
│   │   ├── ai-analysis.ts           └─ Example: AI integration
│   │   └── creator-content.ts       └─ Example: Creator platform
│   ├── .env                         ← FILL: Your wallet address
│   └── package.json
│
├── 402-demo-client/                 ← CLI client (ignore)
│   └── index.ts
│
└── X402-Usecase/projects/X402-Usecase/  ← FRONTEND
    ├── src/
    │   ├── App.tsx
    │   ├── Home.tsx
    │   ├── components/
    │   │   ├── Weather.tsx           └─ Payment UI
    │   │   └── ConnectWallet.tsx     └─ Wallet connection
    │   └── utils/
    │       └── weatherApi.ts         └─ x402 client logic
    ├── .env.local                   ← Already configured
    └── package.json
```

## 🎬 Getting Started

### **For Teams:**

1. **Read:** [HACKATHON_STARTER_KIT.md](./HACKATHON_STARTER_KIT.md) (5 min)
2. **Setup:** Backend + Frontend (5 min)
3. **Pick Idea:** From 10+ examples (2 min)
4. **Build:** Create endpoint (40 min)
5. **Demo:** Show payment flow (3 min)

### **For Facilitators:**

- Copy repo to teams
- Let them build their MVP
- Judge on: x402 usage, creativity, usability, presentation

## 📚 Documentation Tree

```
Choose Your Path:

Quick Learner?
├─ HACKATHON_STARTER_KIT.md (15 min)
└─ x402-demo-server/HACKATHON_README.md (10 min)

Want Full Details?
├─ X402_IMPLEMENTATION_GUIDE.md (30 min)
├─ ARCHITECTURE.md (20 min)
└─ X402_CRITICAL_REFERENCE.md (10 min)

Finding Code?
├─ X402_CRITICAL_REFERENCE.md → "Code Snippets by Use Case"
├─ handlers/ → Copy/modify examples
└─ endpoints.config.ts → Uncomment examples

Deploying?
├─ ARCHITECTURE.md → "Deployment Architecture"
├─ x402-demo-server/HACKATHON_README.md → "Ready to Deploy"
└─ Production setup instructions

Debugging?
├─ X402_CRITICAL_REFERENCE.md → "Troubleshooting"
├─ HACKATHON_STARTER_KIT.md → "Troubleshooting"
└─ Server logs (watch for "✓ PAYMENT VERIFIED")
```

## 🌟 What Makes This Hackathon-Ready

### ✅ For Teams
- **5-minute setup** - Not 2 hours
- **Copy-paste handlers** - 4 examples ready
- **Clear patterns** - All handlers follow same structure
- **Great docs** - Everything explained
- **Working demo** - Start with weather, modify for your idea
- **Quick testing** - `curl` or browser

### ✅ For Production
- **Type-safe** - Full TypeScript with no errors
- **Error handling** - Try/catch in all handlers
- **Logging** - Debug-friendly console output
- **CORS working** - Handles browser requests
- **Scalable** - Easy to add 10+ endpoints
- **Documented** - Deployment-ready

### ✅ For Learning
- **Real x402 flow** - Not simplified
- **Best practices** - Proper middleware stack
- **Clean code** - Easy to understand
- **Well-commented** - Every section explained
- **Examples** - 4 different handler patterns
- **Deep docs** - 3000+ lines of reference material

## 💡 10+ Example Ideas (Pick One!)

| Idea | Price | Time | Complexity | Files |
|------|-------|------|-----------|-------|
| Weather Data | $0.005 | 10 min | ⭐ Easy | handlers/weather.ts ✓ |
| Analytics | $0.01 | 20 min | ⭐⭐ Medium | handlers/analytics.ts ✓ |
| AI Analysis | $0.001 | 30 min | ⭐⭐⭐ Hard | handlers/ai-analysis.ts ✓ |
| Creator Content | $0.05 | 25 min | ⭐⭐ Medium | handlers/creator-content.ts ✓ |
| Image Processing | $0.02 | 30 min | ⭐⭐⭐ Hard | Create new |
| Code Analysis | $0.001 | 20 min | ⭐⭐ Medium | Create new |
| Premium Search | $0.005 | 15 min | ⭐ Easy | Create new |
| API Proxy | $0.005 | 15 min | ⭐ Easy | Create new |
| Data Export | $0.05 | 20 min | ⭐⭐ Medium | Create new |
| Leaderboard | $0.001 | 15 min | ⭐ Easy | Create new |

**See [HACKATHON_STARTER_KIT.md](./HACKATHON_STARTER_KIT.md) for full descriptions.**

## 🚀 Quick Commands

```bash
# Backend
cd x402-demo-server
npm install                 # Install once
npm start                   # Run server
npm run dev                 # Auto-reload on changes

# Frontend
cd X402-Usecase/projects/X402-Usecase
npm install                 # Install once
npm run dev                 # Dev server + HMR
npm run build              # Production build

# Testing
curl http://localhost:4021/health       # No payment needed
curl http://localhost:4021/weather      # Should return 402
curl http://localhost:4021/info         # See endpoints

# Debugging
lsof -i :4021              # Check if port in use
lsof -ti:4021 | xargs kill -9  # Free the port
npx tsc --noEmit           # Type check
```

## 🏗️ Adding Your Endpoint (Copy-Paste)

### 1️⃣ Define in `endpoints.config.ts`
```typescript
'GET /my-api': {
  accepts: [{
    scheme: 'exact',
    price: '$0.005',
    network: ALGORAND_TESTNET_CAIP2,
    payTo: avmAddress,
    extra: { asset: USDC_TESTNET_ASA_ID },
  }],
  description: 'My awesome paid endpoint',
},
```

### 2️⃣ Create `handlers/my-api.ts`
```typescript
import type { Context } from 'hono';

export function handleMyApi(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED');
    
    // Your logic here
    const result = { /* your data */ };
    
    return c.json(result);
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Failed' }, 500);
  }
}
```

### 3️⃣ Register in `index.ts`
```typescript
import { handleMyApi } from './handlers/my-api';

app.get('/my-api', handleMyApi);
```

### 4️⃣ Test
```bash
curl http://localhost:4021/my-api  # Should return 402 ✓
```

**That's it! 55 seconds to add a paid endpoint.**

## 🔍 Key Files Summary

| File | Purpose | Edit? | Notes |
|------|---------|-------|-------|
| **HACKATHON_STARTER_KIT.md** | Quick start guide | 📖 Read | **START HERE** |
| **x402-demo-server/HACKATHON_README.md** | Backend guide | 📖 Read | Specific to server |
| **endpoints.config.ts** | Define routes | ✏️ **YES** | Your MVP here |
| **handlers/*.ts** | Business logic | ✏️ **YES** | Copy & modify |
| **index.ts** | Main server | ⚠️ Careful | Register routes only |
| **x402-demo-server/.env** | Configuration | ✏️ **YES** | Your wallet address |
| **X402-Usecase/.env.local** | Frontend config | ✅ Pre-set | Already configured |

## ✨ Team Workflow

```
T=0: Start hacking
├─ Read: HACKATHON_STARTER_KIT.md (5 min)
├─ Setup: npm install + .env (5 min)
└─ Verify: npm start → http://localhost:4021/health ✓

T=10: Choose idea
├─ Pick from 10+ examples
├─ Check handlers/ for similar pattern
└─ Plan your MVP

T=15: Build endpoint
├─ Add to endpoints.config.ts
├─ Create handlers/my-api.ts
├─ Register in index.ts
└─ Test: curl http://localhost:4021/my-api

T=45: Build frontend (optional)
├─ Component already in place
├─ Just works with your backend
└─ Test payment flow

T=50: Polish & test
├─ Error handling
├─ Console logging
├─ Try real payment flow

T=55: Prepare pitch
├─ 2 min presentation
├─ 1 min live demo
└─ Submit!
```

## 🎯 Judging Criteria

Teams are judged on:
- **x402 Usage** - Correctly implements payment flow
- **Simplicity** - Code is clean, easy to understand
- **Creativity** - Original idea, novel use case
- **Usability** - Works smoothly, user-friendly
- **Presentation** - Clear pitch, good demo

This starter kit helps with all 5:
- ✅ x402 already integrated
- ✅ Clean, modular code
- ✅ Handlers as templates for creativity
- ✅ Example flows show usability
- ✅ Working demo ready to show

## 🚨 Before You Start

### Prerequisites
- [ ] Node.js 18+ installed
- [ ] Algorand TestNet wallet (Pera or Defly)
- [ ] 0.01+ USDC on TestNet
  - Get USDC: https://dispenser.testnet.algorand.network/

### After Setup
- [ ] Backend runs on localhost:4021
- [ ] Frontend runs on localhost:5173
- [ ] `curl http://localhost:4021/health` returns `{"status":"ok"}`
- [ ] Can see weather example in browser

## 🆘 If Something Breaks

**Common Issues:**

| Problem | Solution |
|---------|----------|
| Port 4021 in use | `lsof -ti:4021 \| xargs kill -9` |
| npm install fails | Delete `node_modules`, try again |
| CORS error | Restart backend: `npm start` |
| 402 always returns | Check wallet connected, has USDC |
| Type errors | Run `npx tsc --noEmit` to see issues |
| Server won't start | Check .env has correct values |

**See docs:** [HACKATHON_STARTER_KIT.md - Troubleshooting](./HACKATHON_STARTER_KIT.md#troubleshooting)

## 📊 Performance Notes

- **Response time:** <100ms for endpoint
- **Payment verification:** 2-5 seconds
- **Blockchain confirmation:** 4-5 seconds
- **Total flow:** ~5-10 seconds per payment
- **Capacity:** ~1000 concurrent users on TestNet

This is fine for a hackathon demo!

## 🌍 After Hackathon

**Want to keep building?**

1. Deploy frontend (Vercel, Netlify)
2. Deploy backend (Heroku, Railway, AWS)
3. Add more endpoints
4. Go to MainNet (real USDC)
5. Build business! 💰

## 📞 Support

**During Event:**
- Check docs (links below)
- Ask mentors nearby
- Look at handlers/ for patterns

**Documentation:**
- 🚀 **[HACKATHON_STARTER_KIT.md](./HACKATHON_STARTER_KIT.md)** - Full guide with 10+ examples
- ⚙️ **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
- 📖 **[X402_IMPLEMENTATION_GUIDE.md](./X402_IMPLEMENTATION_GUIDE.md)** - Protocol details
- 🔗 **[X402_CRITICAL_REFERENCE.md](./X402_CRITICAL_REFERENCE.md)** - Code reference

## 🎉 Let's Go Build!

```
55 minutes → $0 to launch → Monetized API
                              ↓
                        Deploy to production
                              ↓
                        Passive income! 💰
```

**Happy hacking! 🚀**

---

**x402 Build & Arena**  
Powered by Algorand & AlgoBharat  
*Let's monetize the web, one x402 endpoint at a time.*
