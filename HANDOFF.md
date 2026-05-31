# 13F Platform — Claude Code Handoff

**Date**: 2026-05-28  
**Branch with all pending work**: `feature/ue01-fund-universe` (local only, not yet pushed)  
**Repo**: https://github.com/davidaxie/13F  
**Live**: https://thirteen-f.vercel.app · https://13f.mapperlab.co

---

## TL;DR for Claude Code

All code for 4 major features is written and on disk. It has **not been committed or pushed** due to a stale `.git/index.lock` on the FUSE-mounted filesystem. You need to:

1. **Remove the lock and push** (one-time fix, see §1)
2. **Add Resend API key** to Vercel env vars (see §2)
3. **Verify the build** passes on Vercel (auto-deploy on push)
4. **Generate snapshots for 19 new funds** once deployed (see §3)

---

## §1 — Git: Remove Lock and Push

The stale lock lives at `.git/index.lock`. Run this from your terminal in the repo root:

```bash
cd ~/Library/CloudStorage/OneDrive-Personal/CS/13F
rm -f .git/index.lock
git add -A
git commit -m "feat: UE-01 + watchlist KV + F-05 cron + P-03 email alerts

- UE-01: Expand fund universe from 9 → 28 funds (19 new marquee funds added to
  MARQUEE_FUNDS in src/lib/funds.ts)
- Watchlist KV migration (P-01/P-02): localStorage → Vercel KV keyed by Clerk
  userId; hybrid fallback for signed-out users; one-time migration on first login
- F-05: Nightly snapshot refresh GitHub Action (.github/workflows/refresh-snapshots.yml)
  + standalone script (scripts/generate-all-snapshots.ts)
- P-03: Email alerts via Resend — subscribe/unsubscribe API, material-move
  detector, weekly digest cron (vercel.json), alert-bell component in watchlist UI
- Fix: add resend to package.json; fix cursor type cast in alerts/send/route.ts"
git push origin feature/ue01-fund-universe
```

Then open a PR on GitHub and merge to `main`, or:
```bash
git checkout main && git merge feature/ue01-fund-universe && git push origin main
```

---

## §2 — Environment Variables to Add

### Resend (P-03 — email alerts)

1. Go to **https://resend.com** → sign up → **API Keys** → create a key
2. Add a sending domain (or use the Resend sandbox `onboarding@resend.dev` for testing)
3. Add to Vercel (all three environments):

```bash
vercel env add RESEND_API_KEY          # paste the re_... key
vercel env add RESEND_FROM_EMAIL       # e.g. alerts@13f.mapperlab.co
vercel env add CRON_SECRET             # any random string, e.g. openssl rand -hex 32
```

`CRON_SECRET` guards the `/api/alerts/send` endpoint so only Vercel's cron runner can trigger it (it sends `Authorization: Bearer <CRON_SECRET>` automatically when you configure it in `vercel.json`).

### Vercel KV (already provisioned)

These should already be set from the prior session. Verify in Vercel Dashboard → Project → Settings → Environment Variables:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

### Clerk (already set)

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

---

## §3 — Generate Snapshots for 19 New Funds

The 19 new funds in `MARQUEE_FUNDS` don't have backtest JSON files yet. The GitHub Action (F-05) will regenerate them weekly, but for the first time you'll want to run manually.

**Fastest path** — hit the existing snapshot API for each new CIK from your dev server:

```bash
# Start dev server in one terminal
npm run dev

# In another terminal — generate all new fund snapshots
for cik in 1048445 1040273 1061165 1135730 1103804 1747057 1079114 1273087 \
            934639 1517137 1159159 1009207 1167557 1138995 1345472 1603466 \
            1649339 1536411; do
  echo "Generating $cik..."
  curl -s "http://localhost:3000/api/snapshot/$cik" \
    -o "src/data/backtest/$cik.json" \
    --max-time 300
  echo "  → done"
done
```

This takes ~30–60 min total (45-day lag + price fetching per fund). Run it overnight. After it finishes:

```bash
git add src/data/backtest/
git commit -m "data: add backtest snapshots for 19 new marquee funds"
git push origin main
```

Then update `src/lib/snapshots.ts` to import the new JSON files (same pattern as the existing 9).

**Or** — just wait. The GitHub Action runs every Monday at 6am UTC and will auto-commit the snapshots.

---

## §4 — What Each Feature Does

### F-05 — Nightly Snapshot Refresh

**Files**:
- `.github/workflows/refresh-snapshots.yml` — GitHub Actions cron (Mondays 6am UTC + `workflow_dispatch`)
- `scripts/generate-all-snapshots.ts` — standalone `npx tsx` script; loops all `MARQUEE_FUNDS`, calls `runBacktest()`, writes JSON to `src/data/backtest/[cik].json`, commits back to `main`

**How it works**: CI checks out the repo, installs deps, runs the script, then uses `git commit --allow-empty` + `git push` to commit any changed JSON files with `[skip ci]` in the message to prevent loops.

**Note**: The `workflow_dispatch` trigger lets you run it manually from GitHub Actions → "Run workflow".

---

### Watchlist KV Migration (P-01 / P-02)

**Files changed**:
- `src/lib/watchlist.ts` — added `kvWatchlist` (server-backed, calls `/api/watchlist`) and `migrateLocalStorageToKv()` (one-time migration on first sign-in)
- `src/components/watchlist-star.tsx` — hybrid: uses `useAuth()` from Clerk; signed-in users use KV path with optimistic UI; signed-out users use the original localStorage path via `useSyncExternalStore`
- `src/app/watchlist/page.tsx` — refactored to use new `watchlist-content.tsx` client component
- `src/app/watchlist/watchlist-content.tsx` — NEW; client component; signed-in: fetches from KV API; signed-out: reads localStorage
- `src/app/fund/[cik]/page.tsx` — minor: passes `cik` prop to WatchlistStar

**New API route**:
- `src/app/api/watchlist/route.ts` — GET/POST/DELETE; uses `@clerk/nextjs/server` `auth()` + `@vercel/kv`; KV key pattern: `watchlist:{userId}:funds` and `watchlist:{userId}:stocks` (Redis Sets)

**Behaviour**:
- Signed out → localStorage (unchanged UX, no server calls)
- Just signed in → `migrateLocalStorageToKv()` runs once, uploads local items to KV, clears local storage
- Signed in → all reads/writes go to `/api/watchlist`, cross-device sync works

---

### UE-01 — Fund Universe Expansion (9 → 28 funds)

**File changed**: `src/lib/funds.ts` — 19 new `MarqueeFund` entries added.

**New funds** (CIK → name → style):

| CIK | Fund | Style |
|-----|------|-------|
| 1048445 | Elliott Management | activist |
| 1040273 | Third Point | activist |
| 1345472 | Trian Fund Management | activist |
| 1517137 | Starboard Value | activist |
| 1061165 | Lone Pine Capital | tigerCub |
| 1135730 | Coatue Management | tigerCub |
| 1103804 | Viking Global Investors | tigerCub |
| 1747057 | D1 Capital Partners | tigerCub |
| 1159159 | JANA Partners | activist |
| 1079114 | Greenlight Capital | value |
| 1138995 | Glenview Capital | value |
| 934639 | Maverick Capital | tigerCub |
| 1649339 | Scion Asset Management | value |
| 1536411 | Duquesne Family Office | macro |
| 1603466 | Point72 Asset Management | quant |
| 1273087 | Millennium Management | quant |
| 1009207 | D.E. Shaw | quant |
| 1167557 | AQR Capital Management | quant |
| 1273087 | Glenview Capital | value |

**What still needs to happen**: generate backtest JSON files (see §3). Until those exist, these funds appear in search with the `★ Tracked` badge but their performance/backtest pages will fall through to the live SEC fetch path (slow but functional).

**Note**: `src/lib/snapshots.ts` still only imports the original 9 funds. After you generate the new JSON files, update `snapshots.ts` to add imports for each new CIK following the existing pattern.

---

### P-03 — Email Alerts via Resend

**New files**:
- `src/lib/alerts.ts` — `detectMaterialMoves(snapshot: FundBacktest): MaterialMove[]`; flags new positions, full exits, and position changes >25% in the most recent quarter
- `src/app/api/alerts/subscribe/route.ts` — POST to subscribe a userId+email to a fund CIK's alerts; DELETE to unsubscribe; GET to list subscriptions. Stores in KV: `alerts:subscriptions:{userId}` (hash: `{cik} → email`)
- `src/app/api/alerts/send/route.ts` — POST (cron endpoint); protected by `CRON_SECRET` header; scans KV for all subscribers; loads each fund's snapshot; calls `detectMaterialMoves()`; sends digest email via Resend; runs every Monday at 8am UTC
- `src/components/alert-bell.tsx` — `"use client"` bell-icon component with dropdown; signed-in users can toggle email alerts per fund; reads/writes to `/api/alerts/subscribe`
- `vercel.json` — registers the cron: `{ "crons": [{ "path": "/api/alerts/send", "schedule": "0 8 * * 1" }] }`

**Email content**: HTML digest with fund name, quarter, and a table of material moves (new positions, exits, big adds/trims). Links back to the fund's filing detail page on `https://thirteen-f.vercel.app`.

**How to wire the bell into fund pages**: Import `AlertBell` from `@/components/alert-bell` and render it next to the watchlist star on `/fund/[cik]/page.tsx`:

```tsx
import { AlertBell } from "@/components/alert-bell";
// ...
<AlertBell cik={fund.cik} fundName={fund.displayName} />
```

This is intentionally left unwired so you can choose placement.

---

## §5 — Package Changes

`package.json` additions vs last commit:
```json
"dependencies": {
  "@vercel/kv": "^3.0.0",    // watchlist KV + alerts subscriber store
  "resend": "^6.12.4"        // email alerts
},
"devDependencies": {
  "tsx": "^4.22.3"           // runs generate-all-snapshots.ts in CI
}
```

Run `npm install` after pulling to get these.

---

## §6 — Remaining Plan Items After This Batch

| ID | What | Status |
|----|------|--------|
| F-05 | Snapshot cron | ✅ Code done, needs push + first run |
| P-01/P-02 | Watchlist KV | ✅ Code done, needs push |
| UE-01 | 28-fund universe | ✅ Metadata done, needs snapshot generation |
| P-03 | Email alerts | ✅ Code done, needs Resend key + push |
| QW-05 | Dashboard freshness timestamp | Depends on F-05 running (adds `generatedAt` field to snapshots) |
| RA-04 | Cohort-normalized leaderboard | Depends on F-05 (8Q-normalized snapshots) |
| RA-06 | T+N execution sensitivity | Needs per-stock daily price series |
| AF-04 | NPORT-P monthly portfolios | Parked — most hedge funds don't file NPORT-P |
| A-08 | Mobile review | Needs real-device testing by user |
| AlertBell wiring | Add AlertBell to fund pages | ~5 min: one import + one JSX line in `/fund/[cik]/page.tsx` |
| snapshots.ts update | Import 19 new JSON files | After snapshot generation in §3 |

**Clerk live keys**: currently using test keys (`pk_test_…`). To go live, generate production keys in Clerk dashboard → re-run `vercel env add` with `pk_live_…` / `sk_live_…`.

---

## §7 — Verification Checklist (after push + Resend setup)

```bash
# All routes 200
for path in / /universe /watchlist /consensus /compare /dashboard /leaderboard \
            /stock/AAPL /fund/1067983 /fund/1067983/performance \
            /fund/1336528 /backtest/follower /backtest/conviction; do
  curl -o /dev/null -s -w "%{http_code} $path\n" "https://thirteen-f.vercel.app$path"
done

# New funds visible in search
curl -s "https://thirteen-f.vercel.app/search?q=Elliott" | grep -c "Elliott"

# Watchlist API (requires auth cookie — test manually in browser)
# 1. Sign in at https://thirteen-f.vercel.app
# 2. Star a fund → check Network tab for POST /api/watchlist
# 3. Sign in on a different browser → verify star persists

# Email alert smoke test
curl -X POST https://thirteen-f.vercel.app/api/alerts/send \
  -H "Authorization: Bearer $CRON_SECRET"
# Should return { "sent": 0 } if no subscribers yet
```

---

## §8 — File Map of Everything Changed/Added This Session

```
Modified:
  package.json                          + resend, @vercel/kv, tsx
  package-lock.json                     updated lockfile
  src/lib/funds.ts                      +19 funds (line 133–330)
  src/lib/watchlist.ts                  +kvWatchlist + migrateLocalStorageToKv
  src/components/watchlist-star.tsx     hybrid localStorage/KV star
  src/app/watchlist/page.tsx            delegates to watchlist-content.tsx
  src/app/fund/[cik]/page.tsx           passes cik to WatchlistStar

New:
  .github/workflows/refresh-snapshots.yml   Monday 6am cron
  scripts/generate-all-snapshots.ts         npx tsx snapshot generator
  src/app/api/watchlist/route.ts            GET/POST/DELETE watchlist KV API
  src/app/api/alerts/subscribe/route.ts     alert subscription management
  src/app/api/alerts/send/route.ts          Resend digest sender (cron target)
  src/lib/alerts.ts                         detectMaterialMoves() logic
  src/components/alert-bell.tsx             per-fund alert toggle UI
  src/app/watchlist/watchlist-content.tsx   client watchlist page component
  vercel.json                               cron registration
  src/lib/backtest-meta.ts                  (helper types, may be unused — verify)
```

---

*Generated by Cowork sprint session — 2026-05-28*
