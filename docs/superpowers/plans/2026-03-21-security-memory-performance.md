# Security, Memory & Performance Hardening Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the app against security vulnerabilities, fix memory leaks, and eliminate the main performance bottlenecks.

**Architecture:** Three-phase approach: (1) Security fixes that protect user data and prevent abuse, (2) Performance fixes targeting the NLP pipeline and IndexedDB queries, (3) Memory management improvements for long-running sessions and family switching.

**Tech Stack:** React 19, Vite 7, Capacitor 8, Dexie 4 (IndexedDB), Zustand 5, @nlpjs/nlp 5, Supabase Edge Functions (Deno)

---

## Chunk 1: Security Hardening

### Task 1: Add Content Security Policy (CSP) Header

**Files:**
- Modify: `index.html:5` (add meta tag)

- [ ] **Step 1: Add CSP meta tag to index.html**

Add after the existing `<meta charset="UTF-8">`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://ixmaxjtkievjkqzeepje.supabase.co wss://ixmaxjtkievjkqzeepje.supabase.co https://challenges.cloudflare.com;
  frame-src https://challenges.cloudflare.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

- [ ] **Step 2: Verify app loads without CSP violations**

Run: `npm run dev`
Open browser console, check for CSP violation errors. If any appear, adjust the policy.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "security: add Content-Security-Policy meta tag"
```

---

### Task 2: Restrict CORS on brain-parse Edge Function

**Files:**
- Modify: `supabase/functions/brain-parse/index.ts:16-21`

- [ ] **Step 1: Replace wildcard CORS with allowed origins**

Replace lines 16-21:

```typescript
// Old:
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  ...
};

// New:
const ALLOWED_ORIGINS = [
  "http://localhost:5173",           // dev
  "https://localhost",               // Capacitor iOS/Android
  "capacitor://localhost",           // Capacitor iOS
  "http://localhost",                // Capacitor Android
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Content-Type": "application/json",
  };
}
```

- [ ] **Step 2: Update all Response calls to use `getCorsHeaders(req)` instead of `CORS_HEADERS`**

Find every `new Response(...)` in the file and pass `req` to get dynamic headers.

- [ ] **Step 3: Test locally**

```bash
npx supabase functions serve brain-parse --env-file .env
```

Send a test request with `Origin: http://localhost:5173` — should work.
Send a test request with `Origin: https://evil.com` — should get rejected origin.

- [ ] **Step 4: Deploy**

```bash
npx supabase functions deploy brain-parse
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/brain-parse/index.ts
git commit -m "security: restrict CORS to app origins on brain-parse edge function"
```

---

### Task 3: Auto-clear Session PIN on App Background

**Files:**
- Modify: `src/store/authStore.js:17,28`
- Create: `src/hooks/useAppLifecycle.js`
- Modify: `src/App.jsx` (import and use the hook)

- [ ] **Step 1: Create useAppLifecycle hook**

```javascript
/**
 * useAppLifecycle — clears session PIN when app goes to background.
 * Works on both Capacitor (native) and web (visibilitychange).
 */
import { useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import useAuthStore from '../store/authStore.js'
import { isNative } from '../lib/platform.js'

export default function useAppLifecycle() {
  useEffect(() => {
    const clearPin = () => {
      useAuthStore.getState().setSessionPin(null)
    }

    if (isNative()) {
      const listener = CapApp.addListener('pause', clearPin)
      return () => { listener.then(l => l.remove()) }
    } else {
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') clearPin()
      }
      document.addEventListener('visibilitychange', onVisibility)
      return () => document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
```

- [ ] **Step 2: Check if `isNative` exists in platform.js**

Look in `src/lib/platform.js` for an `isNative()` export. If not, add:

```javascript
export const isNative = () => typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
```

- [ ] **Step 3: Add hook to App.jsx**

Import and call `useAppLifecycle()` inside the main App component.

- [ ] **Step 4: Test — background the app, return, verify redirect to login**

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAppLifecycle.js src/App.jsx src/lib/platform.js
git commit -m "security: auto-clear session PIN when app goes to background"
```

---

## Chunk 2: Performance — NLP Pipeline

### Task 4: Add Hard Timeout on Claude API Fallback

**Files:**
- Modify: `src/lib/brain/index.js:121`

- [ ] **Step 1: Wrap the AI call with Promise.race timeout**

At line 121, replace the bare await:

```javascript
// Old:
const aiResult = await parseVoiceWithAI(text, context, localResult)

// New:
const AI_TIMEOUT_MS = 5000
const aiResult = await Promise.race([
  parseVoiceWithAI(text, context, localResult),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
  ),
]).catch((err) => {
  console.warn('[Brain] AI fallback timeout/error:', err.message)
  return null
})
```

When timeout fires, `aiResult` will be `null` and the local result is used instead.

- [ ] **Step 2: Run existing brain tests**

```bash
npx vitest run src/lib/brain/
```

Expected: all pass (no AI calls in unit tests).

- [ ] **Step 3: Commit**

```bash
git add src/lib/brain/index.js
git commit -m "perf: add 5s hard timeout on Claude API fallback"
```

---

### Task 5: Fix NLP Polling Interval Leak

**Files:**
- Modify: `src/lib/brainNlp.js:99-102`

- [ ] **Step 1: Add timeout to the polling loop**

Replace lines 99-102:

```javascript
// Old:
const check = setInterval(() => {
  if (isReady) { clearInterval(check); resolve(true) }
}, 200)

// New:
const MAX_WAIT = 30000
const start = Date.now()
const check = setInterval(() => {
  if (isReady) { clearInterval(check); resolve(true) }
  else if (Date.now() - start > MAX_WAIT) {
    clearInterval(check)
    console.error('[NLP] Training timeout after 30s')
    resolve(false)
  }
}, 200)
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/lib/brain/
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/brainNlp.js
git commit -m "fix: add 30s timeout to NLP polling interval to prevent leaks"
```

---

### Task 6: Add destroyNlp() for Family Switching

**Files:**
- Modify: `src/lib/brainNlp.js:77` (add destroy function)
- Modify: `src/store/authStore.js` (call destroy on family switch)

- [ ] **Step 1: Export destroyNlp from brainNlp.js**

After the singleton definition (~line 77), add:

```javascript
export function destroyNlp() {
  nlpInstance = null
  isReady = false
  isTraining = false
  console.info('[NLP] Model destroyed — will retrain on next init')
}
```

- [ ] **Step 2: Call destroyNlp in authStore logout**

In `authStore.js`, in the `logout()` action, add:

```javascript
import { destroyNlp } from '../lib/brainNlp.js'

// inside logout():
destroyNlp()
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/lib/brain/ src/store/
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/brainNlp.js src/store/authStore.js
git commit -m "perf: destroy NLP model on logout to free memory"
```

---

## Chunk 3: Performance — Database

### Task 7: Add Compound Indexes on Dexie

**Files:**
- Modify: `src/lib/localDb.js:227-245` (bump schema version, add indexes)

- [ ] **Step 1: Add compound indexes**

After the current latest version block, add a new version:

```javascript
db.version(10).stores({
  expenses: 'id, family_id, [family_id+date], date, category, person_id',
  events: 'id, family_id, [family_id+date], date, person_id',
  tasks: 'id, family_id, [family_id+due_date], due_date, assigned_to, status',
})
```

Note: Dexie version upgrades are additive — only list tables whose indexes change.

- [ ] **Step 2: Verify app starts without migration errors**

```bash
npm run dev
```

Open browser, check console for Dexie migration errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/localDb.js
git commit -m "perf: add compound indexes [family_id+date] for efficient range queries"
```

---

### Task 8: Batch Transactions in confirmActions

**Files:**
- Modify: `src/hooks/useBrain.js:290-472`

- [ ] **Step 1: Wrap the entire action execution in a Dexie transaction**

Find the `confirmActions` function (line 290). Wrap the core logic:

```javascript
// Old: individual db.events.add(), db.tasks.add(), etc. in a loop

// New: wrap in transaction
import { db } from '../lib/localDb.js'

await db.transaction('rw',
  [db.events, db.tasks, db.expenses, db.shoppingItems, db.meals,
   db.notifications, db.entityRelations, db.messageContexts],
  async () => {
    // ... all the existing action creation logic ...
    // Each db.xxx.add() now participates in one atomic transaction
  }
)
```

- [ ] **Step 2: Run E2E brain tests to verify actions still create correctly**

```bash
npx playwright test e2e/brain-calendar.spec.js
```

Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBrain.js
git commit -m "perf: batch confirmActions into single Dexie transaction"
```

---

### Task 9: Fix Full Table Scan in useWeeklyLeaderboard

**Files:**
- Modify: `src/hooks/useTasks.js:372-376`

- [ ] **Step 1: Add date filter to the Dexie query**

Replace the full scan:

```javascript
// Old:
const allTasks = await db.tasks
  .where('family_id')
  .equals(familyId)
  .and((t) => !t._deleted && t.status === 'done' && t.approved)
  .toArray()

// New: use compound index and date range
const weekStart = startOfWeek(new Date()).toISOString().slice(0, 10)
const weekEnd = endOfWeek(new Date()).toISOString().slice(0, 10)
const allTasks = await db.tasks
  .where('[family_id+due_date]')
  .between([familyId, weekStart], [familyId, weekEnd], true, true)
  .and((t) => !t._deleted && t.status === 'done' && t.approved)
  .toArray()
```

Note: `startOfWeek` / `endOfWeek` — check if already imported from a date util or use simple calculation.

- [ ] **Step 2: Verify leaderboard still shows correct data**

```bash
npm run dev
```

Navigate to Tasks page, check leaderboard counts.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTasks.js
git commit -m "perf: use compound index for weekly leaderboard query instead of full scan"
```

---

## Chunk 4: Memory & Cleanup

### Task 10: Fix useBrain useEffect Cleanup

**Files:**
- Modify: `src/hooks/useBrain.js:104-147`

- [ ] **Step 1: Add cancellation checks to all async operations**

In the useEffect that runs `applyDecay()` and `expireOldDrafts()`, ensure the `cancelled` flag is checked after each await:

```javascript
useEffect(() => {
  let cancelled = false

  async function init() {
    await applyDecay(familyId)
    if (cancelled) return          // ← add check

    await expireOldDrafts(familyId)
    if (cancelled) return          // ← add check

    // ... rest of init
  }

  init()
  return () => { cancelled = true }
}, [familyId])
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/hooks/
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBrain.js
git commit -m "fix: add cancellation checks to useBrain async cleanup"
```

---

### Task 11: Tombstone Purging (Soft-Delete Cleanup)

**Files:**
- Create: `src/lib/dbMaintenance.js`
- Modify: `src/hooks/useBrain.js` (call purge on app init)

- [ ] **Step 1: Create dbMaintenance.js**

```javascript
/**
 * Purge soft-deleted records older than 90 days.
 * Run once per app session to keep IndexedDB lean.
 */
import { db } from './localDb.js'

const PURGE_AFTER_DAYS = 90

export async function purgeTombstones() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PURGE_AFTER_DAYS)
  const cutoffISO = cutoff.toISOString()

  const tables = ['events', 'tasks', 'expenses', 'shoppingItems', 'meals', 'notifications']
  let total = 0

  for (const table of tables) {
    const stale = await db[table]
      .filter((r) => r._deleted && r.updated_at < cutoffISO)
      .primaryKeys()

    if (stale.length > 0) {
      await db[table].bulkDelete(stale)
      total += stale.length
    }
  }

  if (total > 0) console.info(`[DB] Purged ${total} tombstones older than ${PURGE_AFTER_DAYS}d`)
}
```

- [ ] **Step 2: Call purgeTombstones on app init**

In `useBrain.js` init useEffect, add after the other init calls:

```javascript
if (cancelled) return
purgeTombstones().catch(() => {}) // fire-and-forget, non-critical
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/dbMaintenance.js src/hooks/useBrain.js
git commit -m "fix: purge soft-deleted tombstones older than 90 days"
```

---

## Summary

| # | Task | Category | Impact |
|---|------|----------|--------|
| 1 | CSP header | Security | HIGH — prevents XSS |
| 2 | CORS restriction | Security | HIGH — prevents API abuse |
| 3 | PIN auto-clear on background | Security | HIGH — prevents session theft |
| 4 | Claude API timeout | Performance | HIGH — prevents UI hang |
| 5 | NLP polling timeout | Memory | HIGH — prevents interval leak |
| 6 | destroyNlp on logout | Memory | HIGH — frees 10-30MB |
| 7 | Compound Dexie indexes | Performance | HIGH — O(n) → O(log n) queries |
| 8 | Batch confirmActions | Performance | HIGH — 30 transactions → 1 |
| 9 | Weekly leaderboard fix | Performance | HIGH — eliminates full scan |
| 10 | useBrain cleanup | Memory | MEDIUM — prevents stale updates |
| 11 | Tombstone purging | Memory | MEDIUM — unbounded DB growth |

**Estimated total: ~11 tasks, each 5-15 min = about 2h of implementation.**
