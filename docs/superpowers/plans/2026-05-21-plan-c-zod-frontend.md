# Plan C: Zod Frontend Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zod schema validation to every API response in `src/api.ts` so type mismatches (null where number expected, missing fields) surface immediately as console errors instead of silent UI breakage.

**Architecture:** Each response type in `src/types.ts` gets a matching Zod schema in `src/schemas.ts`. Every `fetch` call in `src/api.ts` is wrapped with `schema.parse()`. Invalid responses throw with a descriptive message.

**Tech Stack:** Zod v3, TypeScript, existing React/Vite stack

**Prerequisite:** Plan B must be complete (Go backend serving all routes).

---

### Task 1: Install Zod

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install zod
```

- [ ] **Step 2: Verify**

```bash
node -e "require('zod'); console.log('ok')"
# Expected: ok
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod dependency"
```

---

### Task 2: Define Zod schemas

**Files:**
- Create: `src/schemas.ts`

- [ ] **Step 1: Read current `src/types.ts` to match all fields**

```bash
cat src/types.ts
```

- [ ] **Step 2: Create `src/schemas.ts`**

```typescript
import { z } from 'zod';

export const HoldingSchema = z.object({
  isin: z.string(),
  name: z.string(),
  asset_class: z.string(),
  shares: z.number(),
  avg_cost: z.number(),
  cost_basis: z.number(),
  current_price: z.number().nullable(),
  market_value: z.number().nullable(),
  unrealized_pnl: z.number().nullable(),
  unrealized_pct: z.number().nullable(),
  weight: z.number(),
  fees_paid: z.number(),
  ttm_dividend: z.number(),
  ttm_yield: z.number().nullable(),
});

export const HoldingsResponseSchema = z.object({
  holdings: z.array(HoldingSchema),
  total_market_value: z.number().nullable(),
});

export const TxRowSchema = z.object({
  date: z.string(),
  type: z.string(),
  shares: z.number().nullable(),
  price: z.number().nullable(),
  amount: z.number().nullable(),
  fee: z.number().nullable(),
  tax: z.number().nullable(),
  description: z.string(),
});

export const AssetDetailSchema = z.object({
  isin: z.string(),
  name: z.string(),
  asset_class: z.string(),
  current: HoldingSchema,
  transactions: z.array(TxRowSchema),
});

export const PortfolioSummarySchema = z.object({
  portfolio_value: z.number().nullable(),
  total_invested: z.number(),
  total_pnl: z.number().nullable(),
  total_pnl_pct: z.number().nullable(),
  total_fees: z.number(),
  total_tax: z.number(),
  total_market_value: z.number().nullable(),
  holdings: z.array(HoldingSchema),
});

export const WatchlistItemSchema = z.object({
  isin: z.string(),
  ticker: z.string(),
  name: z.string(),
  notes: z.string(),
  target_price: z.number().nullable(),
  added_date: z.string(),
});

export const WatchlistSchema = z.object({
  items: z.array(WatchlistItemSchema),
});

export const ExportsSchema = z.object({
  exports: z.array(z.string()),
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add src/schemas.ts
git commit -m "feat(frontend): add zod schemas for all api responses"
```

---

### Task 3: Wrap API calls with Zod parsing

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: Read current `src/api.ts`**

```bash
cat src/api.ts
```

- [ ] **Step 2: Add Zod parsing to each fetch call**

At the top of `src/api.ts`, add:
```typescript
import {
  HoldingsResponseSchema,
  AssetDetailSchema,
  PortfolioSummarySchema,
  WatchlistSchema,
  ExportsSchema,
} from './schemas';
```

For each `fetch` call, wrap the JSON parse:

**Before:**
```typescript
const data = await res.json();
return data;
```

**After (example for holdings):**
```typescript
const raw = await res.json();
return HoldingsResponseSchema.parse(raw);
```

Apply the matching schema to every endpoint:
- `fetchHoldings` → `HoldingsResponseSchema`
- `fetchAssetDetail` → `AssetDetailSchema`
- `fetchPortfolio` → `PortfolioSummarySchema`
- `fetchWatchlist` → `WatchlistSchema`
- `fetchExports` → `ExportsSchema`

- [ ] **Step 3: Build to verify no type errors**

```bash
npm run build
# Expected: ✓ built in X.XXs — no errors
```

- [ ] **Step 4: Start dev server and open in browser — check console for Zod errors**

```bash
npm run dev
# Open https://localhost:5173 — check browser console
# Expected: no Zod ZodError messages
```

- [ ] **Step 5: Commit**

```bash
git add src/api.ts
git commit -m "feat(frontend): zod validation on all api responses"
```
