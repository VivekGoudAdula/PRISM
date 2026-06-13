# 🏆 x402 Build Sprint - Starter Kit

> **x402 Build Sprint on Algobharat Dev Retreat**  
> **Duration:** 4 Hours | **Teams:** 10 x 6 people | **Format:** Competitive Build + Presentation

---

## 📋 Event Overview

The x402 Build Sprint is a focused hackathon embedded within the Algobharat Dev Retreat. This is **NOT a traditional hackathon**. Teams are challenged to:

✅ **Identify a real business problem** - Not just a demo  
✅ **Build a product-quality interface** - Users don't see the complexity  
✅ **Implement 2+ x402 endpoints** - Real agents, real payments  
✅ **Get Green Cards verified** - Technical integrity matters  
✅ **Pitch in 3 minutes** - Clear, compelling communication  

**The Prize:** Teams that build genuine value with clean abstraction win.

---

## 🎯 4-Hour Sprint Timeline

| Time | Activity | Duration | Your Team |
|------|----------|----------|-----------|
| **T+0:00** | Teams announced & Tokens distributed | 15 min | 🔄 Form team, get Consulting Tokens (×2) |
| **T+0:15** | Problem scoping & use case definition | 45 min | 🧠 Brainstorm real problems, sketch solution |
| **T+1:00** | **BUILD PHASE STARTS** | 90 min | ⚙️ Setup, code endpoints, get Green Cards verified |
| **T+2:30** | Final build & last Green Card checks

---

## 🎯 What Every Team Must Build

**Requirement 1: Define a Real Business Problem**  
Your use case must reflect genuine friction in a real domain. Example: *"Researchers waste hours finding relevant academic papers across multiple databases."*

**Requirement 2: Build a Clean, Abstracted User Interface**  
Users simply state what they want. They should **never see x402 complexity**. Behind the scenes:
- Multiple x402 agents coordinate
- Each calls a distinct endpoint
- Results aggregate invisibly
- One payment request at the right moment

**Requirement 3: Implement 2+ Working x402 Endpoints**  
Each endpoint performs a distinct function. Together they solve the business problem. Examples:
- Endpoint A: Search SSRN for academic papers
- Endpoint B: Query ProQuest database
- Endpoint C: Save selected papers to Google Drive

**Requirement 4: Surface a USDC Payment Request**  
Present payment at the right moment — after value is demonstrated, before delivery. Users pay once to unlock everything.

**Requirement 5: Obtain Green Cards for Verification**  
Each working endpoint must be verified by a technical verifier. You get a Green Card per verified endpoint.
- **Minimum to present:** 2 Green Cards (2 verified endpoints)
- **Extra credit:** 3+ Green Cards (more working endpoints)

---

## 🎮 Game Mechanics

### 🎟️ Consulting Tokens (×2 per team)
Each team receives **2 Consulting Tokens** at the start.

**What they do:** Redeem one token to get a **1-on-1 consulting session** with an Algorand team member.
- ⏱️ Time-boxed (15-20 min)
- 📋 Use for: Unblocking technical issues, validating use case, endpoint design guidance
- 🎯 Strategic use: Tokens are finite — use wisely!
- **Note:** Judges are NOT available for consulting

### 🏆 Green Cards
A **Green Card** is issued when a verifier confirms your endpoint works as described.

**What they do:** Act as your technical passport
- ✅ Minimum 2 Green Cards required to present to judges
- 📊 Signal depth of implementation (more cards = more endpoints)
- 🔐 Not about quality/novelty — only "does it work?"

**How to get them:**
1. Build endpoint in your server
2. Test it completely
3. Call over a verifier
4. They test it once
5. You get your Green Card

---

## 🧭 The x402 Philosophy

**x402 enables autonomous agents to transact on behalf of users.** These agents:
- Make requests independently
- Receive results
- Trigger payments when value is delivered
- Work silently in the background

**Key Principle: Abstraction**  
Users experience a clean product. They never see:
- x402 protocol details
- Agent orchestration
- Endpoint coordination
- Payment infrastructure

They only see: problem solved → cost displayed → payment made.

---

## ⚡ Quick Setup (5-Minute)

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

✅ Backend runs on: `http://localhost:4021`  
✅ Frontend runs on: `http://localhost:5173`  
✅ Test with: `curl http://localhost:4021/health`

---

## 🏗️ Repository Structure

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

## 👥 Role-Based Guides

### **For Team Participants**

**Your mission in 4 hours:**
1. ✅ **T+0-15:** Form team & understand constraints
2. ✅ **T+15-60:** Identify real problem, scope solution
3. ✅ **T+60-150:** Build endpoints, get Green Cards
4. ✅ **T+150-180:** Polish, test, prepare pitch
5. ✅ **T+180+:** Present & celebrate

**Success looks like:**
- 🧠 Clear, real business problem (not fake)
- 🎯 Clean UI (users don't see x402 internals)
- ⚙️ 2+ verified endpoints (Green Cards proven)
- 💳 Working payment flow
- 🎤 3-minute pitch judges understand

**Start here:**
1. Read [HACKATHON_STARTER_KIT.md](./HACKATHON_STARTER_KIT.md) (10 min)
2. Run setup above (5 min)
3. Check [x402-demo-server/HACKATHON_README.md](./x402-demo-server/HACKATHON_README.md) (5 min)
4. Pick a problem & build!

### **For Judges**

You're evaluating teams on **5 dimensions**:

| Criterion | Description | What to Listen For |
|-----------|-------------|-------------------|
| **Real Business Value** | Does use case solve genuine problem? Would real users pay? | Specific friction, clear pain point, viable market |
| **Novelty** | Original & creative? Beyond obvious applications? | Unique angle, fresh perspective, not seen before |
| **Quality of Abstraction** | Does UI feel like product? Clean experience? | User doesn't need to understand x402, natural workflow |
| **Depth of Implementation** | How many working endpoints? How well integrated? | Green Cards held, endpoints work together smoothly |
| **Clarity of Presentation** | Is problem/solution communicated clearly in 3 min? | Story flows, easy to understand, compelling demo |

**Presentation Format:**
- 3 minutes: Pitch
- 2 minutes: Your Q&A
- Green Cards shown at start as proof

### **For Verifiers**

Your job: Confirm endpoints work as described (NOT judge quality).

**Process:**
1. Team calls you when endpoint is ready
2. Test the endpoint thoroughly
3. If it works → Issue Green Card
4. If it needs work → Give feedback, test again later

**Green Card Checklist:**
- [ ] Endpoint responds correctly
- [ ] Returns expected data format
- [ ] Handles errors gracefully
- [ ] Integrates with payment flow
- [ ] Works with frontend UI

**Note:** You're technical validation, not judges. Be thorough but encouraging!

### **For Organizers**

**Key Responsibilities:**
- 📋 Manage time rigorously (start/end on schedule)
- 🎫 Distribute Consulting Tokens & Green Cards
- 👥 Announce teams at T+0
- 🗣️ Introduce rules & philosophy
- 📊 Facilitate verifier rotation
- ⏱️ Hard stops at T+3:00 for pitches

---

## 📚 Documentation Tree

```
Choose Your Path:

🚀 Quick Start (20 min total)
├─ THIS FILE ← Overview & timeline
├─ HACKATHON_STARTER_KIT.md ← 10+ use case ideas
└─ x402-demo-server/HACKATHON_README.md ← Backend details

📖 Deep Dive (1 hour)
├─ X402_IMPLEMENTATION_GUIDE.md ← Protocol internals
├─ ARCHITECTURE.md ← System design
└─ X402_CRITICAL_REFERENCE.md ← Code lookup

🔧 Need Help?
├─ handlers/ ← Copy example patterns
├─ endpoints.config.ts ← See structure
└─ X402_CRITICAL_REFERENCE.md → Troubleshooting
```

## 🌟 Starter Kit Includes

### ✅ For Fast Onboarding
- **5-minute setup** - Not 2 hours
- **Copy-paste handlers** - 4 examples ready
- **Clear patterns** - All handlers follow same structure
- **Great docs** - Everything explained
- **Working demo** - Start with weather, modify for your idea
- **Quick testing** - `curl` or browser

### ✅ For Quality Delivery
- **Type-safe** - Full TypeScript with no errors
- **Error handling** - Try/catch in all handlers
- **Logging** - Debug-friendly console output
- **CORS working** - Handles browser requests
- **Scalable** - Easy to add 10+ endpoints
- **Production ready** - Deployment-ready code

### ✅ For Rapid Learning
- **Real x402 flow** - Not simplified
- **Best practices** - Proper middleware stack
- **Clean code** - Easy to understand
- **Well-commented** - Every section explained
- **Multiple patterns** - 4 different handler examples
- **Deep docs** - Reference material included

## 💡 Example Use Cases
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

## 🚀 Add Your First Endpoint (90 seconds)

**Step 1: Define in `endpoints.config.ts`**
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

**Step 2: Create `handlers/my-api.ts`**
```typescript
import type { Context } from 'hono';

export function handleMyApi(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED');
    const result = { data: 'your value here' };
    return c.json(result);
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Failed' }, 500);
  }
}
```

**Step 3: Register in `index.ts`**
```typescript
import { handleMyApi } from './handlers/my-api';
app.get('/my-api', handleMyApi);
```

**Step 4: Test**
```bash
curl http://localhost:4021/my-api  # Should return 402 ✓
```

---

## 🏃 4-Hour Team Workflow

```
T+0:00 - T+0:15: FORMATION & SETUP
├─ Teams announced (your name is on board!)
├─ Receive 2 Consulting Tokens
├─ Do quick setup: npm install, .env config
├─ Verify: npm start + npm run dev
└─ Verify: http://localhost:4021/health works ✓

T+0:15 - T+1:00: PROBLEM SCOPING (45 min)
├─ 🧠 Brainstorm: What real problem can you solve?
├─ 📋 Define use case: Specific, genuine, valuable
├─ 🎯 Sketch solution: How x402 fits in
├─ ✍️ Note how many endpoints you'll need (2+)
├─ 👥 Assign roles: Who builds what?
└─ 💡 Consider: How many Green Cards do you aim for?

T+1:00 - T+2:30: BUILD PHASE (90 min)
├─ ⚙️ Build endpoint 1 in backend
│  ├─ Add to endpoints.config.ts
│  ├─ Create handler in handlers/
│  ├─ Register in index.ts
│  └─ Test locally: curl http://localhost:4021/my-endpoint
├─ ✅ Call verifier for Green Card check
├─ 📱 If needed: Update frontend component
├─ ⚙️ Build endpoint 2 (repeat above)
├─ ✅ Get 2nd Green Card verified
├─ ✨ Optional: Build endpoint 3+ for extra credit
└─ 🎟️ Consider: Use Consulting Token if stuck?

T+2:30 - T+3:00: POLISH & PREP (30 min)
├─ 🧪 Test full payment flow end-to-end
├─ 🐛 Fix any bugs or errors
├─ 📝 Prepare 3-minute pitch
│  ├─ Problem statement (1 min)
│  ├─ Solution demo (1.5 min)
│  └─ Why it matters (0.5 min)
├─ 🎬 Practice live demo
├─ 📸 Get Green Cards ready to show
└─ ✅ Check: Do you have minimum 2 Green Cards?

T+3:00 - T+3:50: PRESENTATIONS (50 min)
├─ 🎤 Teams present in order (5 min each)
├─ 🟢 Show Green Cards at start
├─ ⏱️ Pitch (3 min) + Q&A (2 min)
├─ 💳 Demo payment flow if possible
└─ 🙌 Answer judge questions clearly

T+3:50 - T+4:00: JUDGING & WINNERS
├─ 👨‍⚖️ Judges deliberate
└─ 🏆 Winners announced!
```

---

## 🎯 Illustrative Example

**The Problem:**  
An academic researcher needs literature review for "Reverse Logistics" but papers are scattered across SSRN, ProQuest, and JSTOR. Manually searching each takes hours.

**The x402 Solution:**
1. **Frontend:** User types "Find me Reverse Logistics papers"
2. **Intent Agent (Backend):** Breaks request into 3 parallel tasks
3. **Endpoint 1:** Search SSRN → Returns list + price
4. **Endpoint 2:** Query ProQuest → Returns list + price
5. **Endpoint 3:** Check JSTOR → Returns list + price
6. **Aggregation:** Combine results, show user clean interface
7. **Payment:** Single USDC request for selected papers
8. **Fulfillment:** Deliver all to user's Google Drive automatically

**Why this works:**
- ✅ Real problem (researchers actually do this)
- ✅ Clean UX (users see results, not complexity)
- ✅ Multiple x402 endpoints (3 sources)
- ✅ One payment moment (user buys once)
- ✅ Agentic workflow (agents coordinate behind scenes)

---

## 📋 Judging Criteria

Teams are evaluated on:

| Criterion | Weight | Questions Judges Ask |
|-----------|--------|----------------------|
| **Real Business Value** | ⭐⭐⭐⭐⭐ | Does this solve a real problem? Would real users pay? Is there a market? |
| **Novelty** | ⭐⭐⭐⭐ | Is this original? Creative angle? Not seen before? Fresh take? |
| **Quality of Abstraction** | ⭐⭐⭐⭐ | Does UI feel like a product? Clean UX? User forgets about x402? |
| **Depth of Implementation** | ⭐⭐⭐⭐ | Green Cards prove working endpoints. How many? Do they work together? |
| **Clarity of Presentation** | ⭐⭐⭐ | 3-min pitch easy to follow? Demo works? Questions answered clearly? |

---

## ✅ Prerequisites

- [ ] Node.js 18+ installed
- [ ] Algorand TestNet wallet (Pera or Defly app)
- [ ] 0.01+ USDC on TestNet
  - Get testnet USDC: https://dispenser.testnet.algorand.network/

---

## 🆘 Troubleshooting

**Port 4021 already in use:**
```bash
lsof -ti:4021 | xargs kill -9
npm start
```

**npm install fails:**
```bash
rm -rf node_modules
npm install
```

**CORS errors in browser:**
- Restart backend server
- Check frontend .env.local has correct API URL
- Check CORS headers in server logs

**Endpoint returns 402 but shouldn't:**
- Check wallet is connected
- Check wallet has USDC on TestNet
- Check price in endpoints.config.ts is set

**Type errors:**
```bash
npx tsc --noEmit  # See all TypeScript errors
```

**Server won't start:**
- Check .env file has AVM_ADDRESS
- Check FACILITATOR_URL is correct
- Check port 4021 is free

---

## 🏆 Winning Strategy

**Focus on solving a REAL problem, not a demo.**

1. **Pick a genuine problem** (T+0:15-T+0:45)
   - Interview yourselves: "Would I actually pay for this?"
   - Look for specific friction: time wasted, money lost, workflow blocked
   - Real ≠ famous; it can be niche but needs to be real

2. **Keep the interface clean** (T+1:00-T+2:30)
   - Hide x402 complexity completely
   - Users click, get results, see price, pay
   - No technical jargon in UI

3. **Build 2 working endpoints first** (T+1:00-T+2:00)
   - Use Consulting Tokens if stuck
   - Get both Green Cards verified
   - Get them working TOGETHER (not separately)

4. **Optional: 3rd endpoint for differentiation** (T+2:00-T+2:30)
   - Only if first two are solid
   - Extra Green Card = signal of depth

5. **Pitch with confidence** (T+3:00-T+3:05)
   - Lead with the problem (judges care about this first)
   - Show payment flow works (live if possible)
   - Mention Green Cards held as proof

**Judges' perspective:** Novelty is secondary to real value. They'll remember: "This team found a genuine problem and solved it cleanly with x402."

---

## 📚 File Reference

| File | Purpose | Edit? |
|------|---------|-------|
| **THIS FILE** | 4-hour sprint overview | 📖 Read |
| **HACKATHON_STARTER_KIT.md** | 10+ use case ideas | 📖 Read |
| **x402-demo-server/HACKATHON_README.md** | Backend specifics | 📖 Read |
| **endpoints.config.ts** | Define your routes | ✏️ **EDIT** |
| **handlers/*.ts** | Your business logic | ✏️ **EDIT** |
| **index.ts** | Register routes | ⚠️ Careful |
| **X402_IMPLEMENTATION_GUIDE.md** | Deep protocol dive | 📖 Reference |
| **ARCHITECTURE.md** | System design | 📖 Reference |

---

## 💡 Quick Reference: Consulting Tokens

You have **2 tokens per team**. Use them strategically:

**Good uses:**
- ✅ "Our endpoint keeps crashing, please debug"
- ✅ "We're unsure if our use case is valid, review?"
- ✅ "How should we structure this payment?"

**Bad uses:**
- ❌ "Build our endpoint for us"
- ❌ "Tell us what idea to pick" (brainstorm yourselves!)
- ❌ "Same question we already asked" (take notes)

**Pro tip:** Save at least 1 token for T+2:00-T+2:30 in case you hit a blocker.

---

## 🎯 Key Reminders

| Item | Must Have | Why |
|------|-----------|-----|
| 2+ Green Cards | ✅ Required | Minimum to present |
| Real problem | ✅ Required | Judges evaluate on this first |
| Working payment | ✅ Required | Demonstrates x402 integration |
| Clean UI | ✅ Required | "Quality of Abstraction" criterion |
| 3-min pitch | ✅ Required | Hard time limit |
| Live demo | ⚡ Nice-to-have | Impressive if it works |
| 3+ endpoints | ⭐ Bonus | Signals depth |
| Deployed version | ⭐ Bonus | Shows you can ship |

---

## 📞 Getting Help

**During the sprint:**
- 📖 **Read docs first** - Many answers are already here
- 🎟️ **Use a Consulting Token** - For real blockers
- 👥 **Ask nearby mentor** - Often faster for quick questions
- 🔍 **Check handlers/** - See similar patterns

**Quick links:**
- 🚀 [HACKATHON_STARTER_KIT.md](./HACKATHON_STARTER_KIT.md) - Use cases & ideas
- ⚙️ [x402-demo-server/HACKATHON_README.md](./x402-demo-server/HACKATHON_README.md) - Backend setup
- 🔗 [X402_CRITICAL_REFERENCE.md](./X402_CRITICAL_REFERENCE.md) - Code reference
- 📖 [X402_IMPLEMENTATION_GUIDE.md](./X402_IMPLEMENTATION_GUIDE.md) - Protocol deep dive
- 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

## 🎬 Action Plan: Your First 30 Minutes

```
T+0:00-T+0:05: Read this README (fast scan)
T+0:05-T+0:10: Do npm install (background)
T+0:10-T+0:15: Verify health endpoint works
T+0:15-T+0:30: Brainstorm 3 problem ideas with team
├─ Pick the REALEST one
├─ Sketch how x402 fits in
└─ Commit to it!

→ You're now ready to build.
```

---

## 🎉 Let's Go Build!

```
4 hours of focused building → 1 working product → Real value
                              ↓
                        Working x402 payment flow
                              ↓
                        Maybe a great business! 🚀
```

**x402 Build Sprint** — Where agents earn, users save, and teams learn.

---

**Questions? Check the docs. Blocked? Use a token. Let's build!** 🚀
