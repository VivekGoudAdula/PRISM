# 📂 Project File Tree - Quick Reference

> **Print this or bookmark for easy navigation**

## 🎯 Team's MVP Workspace

```
x402-demo-server/  ← MAIN FOCUS FOR TEAMS
│
├─ 📖 HACKATHON_README.md             ← Backend quick start
├─ 📝 endpoints.config.ts             ← EDIT: Define your routes
├─ 🔧 index.ts                        ← Main server (don't edit)
│
├─ 📦 handlers/                       ← EDIT: Add your logic
│  ├─ weather.ts                      └─ Copy if building simple API
│  ├─ analytics.ts                    └─ Copy if doing dashboards
│  ├─ ai-analysis.ts                  └─ Copy if integrating AI
│  └─ creator-content.ts              └─ Copy if monetizing content
│
├─ ⚙️ .env                            ← EDIT: Your wallet address
├─ 📋 .env.example                    ← Reference template
├─ 📦 package.json                    ← Dependencies (don't edit)
├─ 🔧 tsconfig.json                   ← TypeScript config (don't edit)
└─ 📚 node_modules/                   ← Created by npm (ignore)
```

## 📚 Documentation Map

```
Root Level Documentation
├─ 🚀 README_HACKATHON.md             ← START HERE!
│  └─ Overview, structure, quick start
│
├─ 📖 HACKATHON_STARTER_KIT.md       ← Detailed team guide
│  └─ Setup, examples, testing, troubleshooting
│
├─ 🏛️ ARCHITECTURE.md                 ← System design
│  └─ Diagrams, components, data flow
│
├─ 📋 X402_IMPLEMENTATION_GUIDE.md   ← Protocol deep dive
│  └─ Complete flow, network config, debugging
│
├─ 🔗 X402_CRITICAL_REFERENCE.md     ← Code lookup
│  └─ File locations, code snippets, quick commands
│
├─ ✅ FACILITATOR_CHECKLIST.md        ← For event organizers
│  └─ Setup, troubleshooting, judging rubric
│
└─ ⚙️ HACKATHON_TRANSFORMATION_SUMMARY.md  ← What changed
   └─ Complete list of improvements
```

## 🎯 Team's 55-Minute Journey

```
Minute 0-5: Setup
├─ Clone project
├─ Run: npm install (backend)
├─ Run: npm install (frontend)
├─ Create: .env file
└─ Start: npm start (check http://localhost:4021/health)

Files touched: .env only

─────────────────────────────────────────

Minute 5-15: Learn Pattern
├─ Read: HACKATHON_STARTER_KIT.md (5 min)
├─ Pick idea from examples
└─ Look at handlers/*.ts for similar pattern

Files read: handlers/weather.ts or handlers/analytics.ts

─────────────────────────────────────────

Minute 15-35: Build Endpoint
├─ Edit: endpoints.config.ts (add route definition)
├─ Create: handlers/my-endpoint.ts (create handler)
├─ Edit: index.ts (register route - 1 line)
└─ Test: curl http://localhost:4021/my-endpoint

Files edited: 
  ✏️ endpoints.config.ts
  ✏️ handlers/my-endpoint.ts (NEW FILE)
  ✏️ index.ts (add 2 lines)

─────────────────────────────────────────

Minute 35-50: Test & Refine
├─ Test: curl (first request = 402)
├─ Test: Browser (full payment flow)
├─ Debug: Check console logs
├─ Improve: Add error handling
└─ Polish: Clean up code

Files edited:
  ✏️ handlers/my-endpoint.ts (refinement)

─────────────────────────────────────────

Minute 50-55: Prepare Demo
├─ Make sure everything works
├─ Plan 2-min pitch
├─ Practice 1-min demo
└─ Take screenshots

Files read: None - just practice!
```

## 🔍 File Purposes at a Glance

| File | Purpose | Edit? | Time |
|------|---------|-------|------|
| endpoints.config.ts | Define payment routes | ✏️ YES | 5 min |
| handlers/my-api.ts | Business logic | ✏️ YES | 15 min |
| index.ts | Register routes | ✏️ 1 line | 2 min |
| .env | Your wallet address | ✏️ YES | 1 min |
| package.json | Dependencies | ❌ NO | - |
| tsconfig.json | TypeScript config | ❌ NO | - |
| HACKATHON_README.md | Backend guide | 📖 READ | 10 min |

## 💡 3-Step Pattern (Copy This!)

```
STEP 1: Define in endpoints.config.ts
────────────────────────────────────

'GET /my-api': {
  accepts: [{
    scheme: 'exact',
    price: '$0.005',
    network: ALGORAND_TESTNET_CAIP2,
    payTo: avmAddress,
    extra: { asset: USDC_TESTNET_ASA_ID },
  }],
  description: 'My awesome API',
},


STEP 2: Create handlers/my-api.ts
──────────────────────────────────

import type { Context } from 'hono';

export function handleMyApi(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED');
    return c.json({ data: 'your response' });
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Failed' }, 500);
  }
}


STEP 3: Register in index.ts
────────────────────────────

// At top:
import { handleMyApi } from './handlers/my-api';

// In ROUTE HANDLERS section:
app.get('/my-api', handleMyApi);


DONE! ✓ You have a paid endpoint!
```

## 🎮 Quick Test Commands

```bash
# Test 1: Is server running?
curl http://localhost:4021/health

# Test 2: Does your endpoint exist?
curl http://localhost:4021/my-endpoint
# Should return: 402 Payment Required ✓

# Test 3: Full flow in browser
Open: http://localhost:5173
Connect wallet → Request data → Approve → See result ✓

# Test 4: Check logs
# In terminal where you ran: npm start
# Look for: "✓ PAYMENT VERIFIED"
```

## 📋 Folder Structure Explained

```
x402-demo-server/                Backend Server
├─ handlers/                      Where business logic lives
│  └─ Each file = one endpoint
│
├─ endpoints.config.ts           Configuration (easy editing)
├─ index.ts                      Server setup (don't break!)
├─ .env                          Your secrets
├─ package.json                  Dependencies
└─ node_modules/                 Generated (ignore)

X402-Usecase/projects/           Frontend App
└─ X402-Usecase/
   ├─ src/                       React source
   │  ├─ components/             UI components
   │  │  └─ Weather.tsx          Example payment component
   │  └─ utils/                  Helper functions
   │     └─ weatherApi.ts        x402 payment logic
   ├─ .env.local                 Already configured
   └─ package.json               Dependencies
```

## 🎯 Files You Will Edit

```
DEFINITELY EDIT (3):
├─ endpoints.config.ts    ← Add your route definition
├─ handlers/my-api.ts     ← Create (new file)
└─ index.ts               ← Add 2 lines to register

MAYBE EDIT (1):
└─ .env                   ← Copy wallet address

DON'T TOUCH (rest):
├─ index.ts (except register line)
├─ package.json
├─ tsconfig.json
├─ Frontend files
└─ node_modules/
```

## 🚀 From Zero to Payment API in 3 Steps

```
endpoints.config.ts
    ↓ (define route + price)
    ↓
handlers/my-api.ts
    ↓ (write business logic)
    ↓
index.ts
    ↓ (register route)
    ↓
PAYMENT API ✓
```

## 📊 Success Checklist

- [ ] Backend runs: `npm start` works
- [ ] Frontend runs: `npm run dev` works
- [ ] Route defined in `endpoints.config.ts`
- [ ] Handler created in `handlers/`
- [ ] Handler imported in `index.ts`
- [ ] Route registered in `index.ts`
- [ ] curl returns 402: ✓
- [ ] Browser full flow works: ✓
- [ ] Data returned after payment: ✓
- [ ] Ready to demo: ✓

## 🎓 Learning Map

```
I want to...                          Read this
─────────────────────────────────────────────────────
Understand x402                       X402_IMPLEMENTATION_GUIDE.md
Get started quickly                   HACKATHON_STARTER_KIT.md
Build my endpoint                     handlers/ (examples)
Find code snippets                    X402_CRITICAL_REFERENCE.md
See system design                     ARCHITECTURE.md
Debug problems                        X402_CRITICAL_REFERENCE.md
Deploy to production                  ARCHITECTURE.md
Understand this folder                This file (FILE_TREE.md)
Learn backend details                 x402-demo-server/HACKATHON_README.md
Organize the event                    FACILITATOR_CHECKLIST.md
```

## ⏱️ Time Budget (55 min)

```
Minute  0-5:  Setup (npm install, .env)
Minute  5-10: Read quick start
Minute  10-15: Pick idea & check examples
Minute  15-25: Add endpoint config
Minute  25-35: Create handler
Minute  35-40: Test with curl
Minute  40-50: Test in browser + fix bugs
Minute  50-55: Polish + prepare demo
```

## 🆘 If Something Breaks

```
Problem                         Solution
─────────────────────────────────────────────────────
npm won't install              npm cache clean --force
Port 4021 in use               lsof -ti:4021 | xargs kill -9
CORS error                     Restart backend
402 always returns             Check wallet has USDC
Can't import handler           Check file exists & is exported
TypeScript errors              npx tsc --noEmit
Frontend won't load            Check npm run dev in right dir
Wallet won't connect           Check testnet selected
Can't find docs                They're all in root folder
```

## 🎁 What's Included

```
✅ Working Backend        Ready to extend
✅ Working Frontend       Already integrated
✅ 4 Handler Examples     Copy & modify
✅ Type Safety            Full TypeScript
✅ Documentation          3000+ lines
✅ Quick Start            5 minutes setup
✅ Code Patterns          Copy-paste templates
✅ Error Handling         Best practices
✅ Logging                Debug-friendly
✅ CORS Configured        Works in browser
```

---

**Print this page or bookmark for quick reference during the hackathon!** 📌
