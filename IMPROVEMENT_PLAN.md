# 13F Platform — Improvement Plan

A two-part document:

- **Part I**: critical review of the platform from a hedge-fund-allocator's perspective.
- **Part II**: a phased, item-by-item execution plan to close the gaps identified in Part I.

> **Engineering note.** Per `AGENTS.md`, this codebase uses Next.js 16 (App Router) and React 19 — APIs differ from older Next.js. Before implementing any item that touches routing, data fetching, or server components, read the relevant guide in `node_modules/next/dist/docs/`.

---

## Execution status (updated)

29 of the 37 planned items shipped. Eight items remain genuinely blocked on external decisions or data sources — see "Blocked / needs decision" below.

### Shipped (29)

| ID | Title | Notes |
|---|---|---|
| F-01 | Centralize unit conversion | `getHoldings` now returns whole dollars always |
| F-02 | Test harness | Vitest + 26 regression tests |
| QW-01 | `/stock/[ticker]` page | Cross-fund holders view |
| QW-02 | Dollar / % toggle on dashboard | |
| QW-03 | CSV export | Holdings table + dashboard sections |
| QW-04 | ★ Tracked search badge | Routes tracked funds straight to /performance |
| QW-06 | Risk profile on performance page | Sharpe, MaxDD, β, IR, capture ratios |
| QW-07 | Landing suggestion fix | Baupost → Appaloosa |
| QW-08 | Top 10 holdings on `/fund/[cik]` | |
| CS-01 | `/consensus` cross-fund crowding | |
| CS-03 | `/compare` side-by-side | |
| CS-04 | Position lineage on stock page | Trade history table |
| CS-05 | Cohort filter on dashboard | Value/Activist/Tiger Cub/Quant/Macro |
| CS-06 | Holdings table change-type chips | + uncapped exits |
| RA-01 | Drawdown / underwater curve | |
| RA-02 | Rolling 1y alpha chart | |
| RA-05 | Transaction-cost overlay | 0/5/10/25 bps chips on follower |
| RA-08 | Conviction "sell when fund sold" mode | Methodology pair to "hold to today" |
| UE-02 | `/universe` page | Sortable table of all tracked funds |
| UE-03 | Per-fund metadata + AUM sparkline | |
| AF-03 | 13F-HR/A amendment surfacing | Visual pill on filings list |
| P-01 | Fund watchlists | localStorage + cross-tab sync |
| P-02 | Stock watchlists | Same primitive |
| A-01 | Tighten "actionable" wording | "picks" → "positions" + caveat |
| A-02 | Material-caveat callouts | Top-of-page on all backtest pages |
| A-03 | Survivorship-bias disclosure | Explicit bullet on backtest pages |
| A-04 | Options notional disclaimer | "may be hedges / income trades" |
| A-06 | QoQ / YoY comparison toggle | On filing detail page |
| A-07 | A11y partial pass | Skip link, focus styles, ARIA labels |
| A-09 | Print stylesheet | |
| A-10 | Ticker / CUSIP hint on search | |

### Blocked / needs decision (8)

| ID | Title | Blocker |
|---|---|---|
| F-03 | GICS sector reference data | Needs data licensing decision (free hand-curated vs paid feed) |
| F-04 | Persistent cache | Needs Vercel KV / Upstash credentials |
| F-05 | Build-time aggregation | Needs snapshot-regen workflow + scheduled CI |
| QW-05 | Dashboard freshness timestamp | Depends on F-05 |
| CS-02 | Sector lens / heatmap | Depends on F-03 |
| RA-03 | Benchmark switcher (SPY/IWM/QQQ/EFA/AGG/60-40) | Needs bundled Yahoo price series for new tickers |
| RA-04 | Cohort-normalized leaderboard | Depends on F-05 (8Q-normalized snapshots) |
| RA-06 | T+N execution sensitivity | Needs per-stock daily price series — not in snapshots |
| RA-07 | Fama-French factor decomposition | Needs FF data fetch + regression infra |
| UE-01 | Expand universe to 30 funds | Needs snapshot regeneration for new CIKs (~hours of SEC fetches per fund) |
| AF-01 | Schedule 13D/13G ingestion | New EDGAR parser, multi-day effort |
| AF-02 | Form 4 insider overlay | Same |
| AF-04 | NPORT-P monthly portfolios | Plan flagged as XL/deferred |
| P-03 | Email alerts | Needs auth (P-04) + email provider |
| P-04 | Authentication | Needs auth provider choice (Clerk / Supabase / Stytch) |
| A-05 | Centralized holdings toolbar | Substantively done via CS-06; ID kept for completeness |
| A-08 | Mobile review pass | Needs real-device testing + iteration |

Of the eight in the "really blocked" category, the cleanest path to clearing more is **F-04 (Vercel KV)** — the user provisioning the KV store unblocks F-05, which unblocks QW-05, RA-04, and UE-01. The other big unlock is **F-03 (GICS data source decision)** which unblocks CS-02.

---

# Part I — Critical Review

## 1. Strategic Verdict

The product is beautifully designed and the backtest layer (follower / conviction) is more analytically serious than 90% of free 13F sites. But for a real allocator, **this is a single-fund inspection tool with a thin marquee leaderboard pasted on top** — not a 13F intelligence platform. The biggest gaps are conceptual:

1. **9-fund universe** is too narrow for any real positioning work. Whales like Lone Pine, Coatue, Greenlight, Third Point, ValueAct, Maverick, Viking, Glenview, D1, Altimeter, Baupost, JANA, Trian, Marcato, Starboard, Senator — all missing.
2. **No cross-sectional view of a stock.** I cannot ask "who owns NVDA, how has that changed, who's new in?" — the #1 reason allocators look at 13Fs.
3. **No consensus / crowding detection.** I can't see what 5+ smart funds bought at once last quarter, nor what's getting hated on.
4. **No risk / factor lens** on the fund-level backtests — return % with no beta, vol, Sharpe, or drawdown context is naïve.
5. **Backtest methodology is uneven.** Heavy funds use 8-quarter snapshots (acknowledged), but this means the leaderboard ranks 15-year track records vs 2-year track records on the same axis.
6. **Search → dead end.** Users can search 8,000+ filers via EDGAR full-text but only 9 of them produce a backtest. The other ~99.9% of paths terminate at a holdings list.

The data, parsing, pricing, and aggregation primitives already exist. The work is layering missing analytical lenses on top, not rewriting the foundation.

---

## 2. Universe & Coverage Gaps

### What's there
9 marquee CIKs in `src/lib/dashboard.ts`: Berkshire, Pershing, Tiger, Renaissance, Bridgewater, Citadel, Soros, Appaloosa, Two Sigma.

### What's missing
- **Tiger Cubs**: Lone Pine, Coatue, Maverick, Viking, D1, Light Street, Altimeter.
- **Activists**: Elliott, Trian, ValueAct, JANA, Starboard, Third Point, Engine Capital.
- **L/S equity**: Greenlight, Viking, Pelham, Lakewood, Glenview, Egerton.
- **Quant** beyond RenTech/Two Sigma: D.E. Shaw, AQR, Millennium, Balyasny, Marshall Wace, Man.
- **SMID specialists**: Bares, Akre, Polen, Wedgewood, Sequoia (Ruane), Smead.
- **Solo / famous**: Burry (Scion), Pabrai, Spier, Klarman (Baupost).

> The landing page (`src/app/page.tsx`) suggests "Baupost Group" but Baupost is *not* in `MARQUEE_FUNDS` — clicking the suggestion lands on a fund page with no backtest, no leaderboard entry, no dashboard card. Broken promise.

---

## 3. Data Layer Gaps

### 13F fields ignored

| Field | In 13F XML | Used? |
|---|---|---|
| Investment discretion (sole/shared/none) | Yes | No |
| Voting authority (sole/shared/none) | Yes | No |
| Other manager # | Yes | No |
| Confidential treatment | Yes | No |
| 13F-HR/A amendments | Yes | Acknowledged in commits, no UI |
| 13F-NT (notice filings) | Yes | No |

### Adjacent filings that 10x signal
- **Form 4** (insider transactions) overlay.
- **Schedule 13D / 13G** (5%+ ownership; activists declare intent here *before* 13F).
- **Form N-PX** (proxy voting).
- **Form ADV** (real AUM, not just 13F-eligible long equity).
- **Form NPORT-P** (monthly portfolios for registered funds).

### Reference data missing
- GICS sector / industry mapping.
- Market cap / float / shares outstanding (blocks "% of float owned" — the only crowding metric that matters for liquidity).
- ETF/ADR classification (a 13F that's 30% in QQQ isn't picking stocks).
- Issuer-level FIGI/CIK linkage (CUSIP changes from restructurings silently break share-change calcs).

---

## 4. Analytics Gaps — The Biggest Pile

### A. Stock-centric views (zero)
The #1 allocator workflow: "show me NVDA and who owns it across all funds, sliced by quarter." Currently impossible.

### B. Consensus & crowding (zero)
- Hedge Fund Consensus Top-50.
- New Hedge Fund Favorites (stocks newly bought by ≥3 marquee funds in same quarter — Goldman's "VIP List" pattern).
- Crowding score per name (Herfindahl over fund ownership).
- Anti-positioning (high-conviction disagreement between funds).
- "Falling stars" (≥3 funds trimming simultaneously).

### C. Sector / factor lens (zero)
- Net dollar change by GICS sector per fund and aggregated.
- Sector heatmap.
- Fama-French factor regression on mirror returns (separates skill from style tilt).
- Concentration metrics (top-10 weight, top-5 sector, HHI).

### D. Risk metrics (basic stats only — major gap)
The performance page shows: total return, alpha vs SPY, win rate, avg return. Missing:
- Max drawdown + trough date.
- Annualized volatility.
- Sharpe and Sortino.
- Beta vs SPY (a 2x-beta strategy beating SPY by 5%/yr isn't alpha, it's leverage).
- Information ratio (alpha / tracking error).
- Hit rate vs base rate (SPY is up 70% of quarters).
- Upside/downside capture.
- Rolling 1-year alpha.

Without these, the leaderboard heavily favors high-beta strategies in bull markets.

### E. Time-aware analytics (zero)
- 45-day disclosure-lag heatmap (do best trades cluster at the deadline?).
- Quarterly turnover.
- Average holding period actually computed (not just `avg fund hold 6.2Q`).
- First-mover detection per stock.

### F. Drilldowns
- Position lineage for (fund, stock) pair — multi-quarter trajectory with price overlay.
- Filing diff filterable by changeType.
- Compare two funds side-by-side.

---

## 5. Backtest Methodology Critique

### Critical
1. **Heavy funds use only 8 quarters.** Leaderboard ranks 15-year track records vs 2-year track records on the same axis. Fix: normalize windows or split leaderboards.
2. **No transaction costs / slippage / taxes / borrow.** Fine for personal tool, **not for hedge-fund-targeted product.** Model 5 bps slippage minimum; surface net-of-costs.
3. **Filing-date pricing is the earliest theoretical entry, not realistic.** Real execution is T+1 to T+5. Add a T+N sensitivity table.
4. **No survivorship-bias check.** Sample is 9 famous-name survivors; biased upward by construction.
5. **Options handled inconsistently.** `cross-fund-highlights.tsx` treats puts as bearish bets and calls as bullish, but puts can hedge longs and calls can be cash-secured. Need delta-adjusted notional.

### Medium
6. CUSIP-to-ticker mapping failures are hidden — user can't tell which positions were dropped.
7. No FX/ADR handling.
8. Conviction page mixes dollar-weighted and equal-weighted returns.
9. No regime analysis (no trailing-12M alpha series).
10. "Buy-and-hold-to-today" framing systematically benefits stocks the fund is still holding. Pair with "buy-and-hold-but-cap-at-fund-exit."

### Minor
11. Position-size slider has hardcoded presets; let users type a value.
12. No view of which signals failed (delisted, halted, M&A, spinoffs).

---

## 6. Page-by-Page UX Critique

### Landing — `src/app/page.tsx`
- Beautiful but Baupost suggestion is a dead-end (see §2).
- No teaser of leaderboard/backtests for new visitors.
- No "Featured this quarter" hook.

### Search — `src/app/search/page.tsx`
- Clean EDGAR pass-through.
- No "Tracked here" indicator.
- No pagination, sort, SIC filter, AUM column.

### Fund overview — `src/app/fund/[cik]/page.tsx`
- No current holdings preview (must click into latest filing).
- No fund description, strategy, AUM, founders.
- No AUM-over-time sparkline.

### Filing detail — `src/app/fund/[cik]/[accession]/page.tsx`
- "Exited positions" hardcoded to 8 (line 144).
- Can't filter holdings table by changeType.
- No sector column.
- No CSV export.
- No "compare to N quarters ago" toggle.

### Performance — `src/app/fund/[cik]/performance/page.tsx`
- **No risk metrics** (see §4D).
- Scatter bubble = position size at entry, but entry sizes are ~equal — bubbles uninformative.
- Best/worst pick are lottery tickets, not insight.
- No drawdown plot.
- No rolling 1y alpha.
- No benchmark choice (only SPY).

### Dashboard — `src/app/dashboard/page.tsx`
- Six sections global across all 9 funds; can't filter to a subset (e.g., "activists only").
- No sub-filtering by sector/market-cap/portfolio-weight.
- Dollar ranking only; need "% of portfolio change" ranking.
- Fund cards limited to top-2 of each move-type.
- No consensus section.
- No freshness indicator.

### Leaderboard — `src/components/leaderboard.tsx`
- Ranks on terminal mirror return only — see §5.1.
- SPY-only benchmark (wrong for Bridgewater, Renaissance).
- No sort by Sharpe / IR / recent alpha.

### Follower backtest — `src/app/backtest/follower/page.tsx`
- Position-size slider is novel UX.
- Headline mixes 9 funds with different history lengths.
- No drawdown / worst rolling window.
- No per-fund toggle.
- No T+N sensitivity bands.

### Conviction backtest — `src/app/backtest/conviction/page.tsx`
- Best analytical work in the product.
- Acknowledges heavy-fund snapshot issue but doesn't fix it.
- "Conviction = (last appearance − first appearance)" measures duration, not conviction. A 100-share placeholder over 20Q gets the same score as a 5%-weight conviction position.
- Currently-held picks table needs export and a second slider for minimum portfolio weight.

---

## 7. Risk, Compliance & Caveats

- "Not investment advice" footer is fine, but the conviction page's "actionable buy list" framing is on the edge. Tighten wording.
- No data freshness indicator anywhere.
- Caveats buried at bottom of backtest pages — promote material ones (transaction costs, snapshot inconsistency, options exclusion) to a headline callout.
- No accessibility audit visible.

---

## 8. Engineering & Architecture Concerns

- **9 marquee funds × `Promise.all` on dashboard** is fine, but at 50+ funds, cold paths will exceed Vercel's 60s. Need build-time aggregation or persistent cache.
- **`isValueInThousands(filingDate)` at every aggregation site** is a footgun. Centralize at `getHoldings` boundary — return dollars, always.
- **Aggregation key `cusip|titleOfClass|putCall`** silently merges/splits share-class variants. Document the choice.
- **Zero tests in the repo.** Backtest math is non-trivial; commit `ce8f549` ("Fix two backtest data bugs") confirms bugs ship undetected.

---

## 9. Strategic Positioning

- **13F.info, WhaleWisdom, Stockcircle, Fintel** already do: holdings browse, simple QoQ diffs, raw filings. Don't compete on this.
- **They don't do well**: honest risk-adjusted backtests, factor decomposition, custom baskets, signal-quality scoring, 13D/G/Form 4 integration. **This is the wedge.**

---

# Part II — Execution Plan

## Structure

Work is grouped into **seven phases** by dependency order, not by priority. Earlier phases unblock later ones.

Each item has:
- **ID** (e.g., `QW-01`) — stable handle for tracking.
- **Description** — what ships.
- **Files** — what to create or modify.
- **Approach** — concrete steps.
- **Depends on** — IDs that must ship first.
- **Acceptance** — verifiable definition of done.
- **Effort** — S (≤1 day), M (2–5 days), L (1–3 weeks), XL (1+ month).

Total scope is ~50 items across 7 phases. The plan assumes one engineer working ~full-time; with that, **Phase 0 + Phase 1 is ~3 weeks**, the full plan is **~6 months**.

---

## Phase 0 — Foundations (unblock everything)

The current architecture has a few load-bearing weak spots. Fix these first; every later phase rests on them.

### F-01 · Centralize unit conversion at the data boundary  ·  S
**Why.** `isValueInThousands(filingDate)` is called at every aggregation site. Easy to forget. Already nearly caused (or did cause) the bugs in commit `ce8f549`.
**Files.** `src/lib/edgar.ts` (`getHoldings`), `src/lib/parse-13f.ts`, every caller (`dashboard.ts`, filing detail page, backtests).
**Approach.**
1. Modify `getHoldings` to return `value` in whole dollars always; encapsulate the units check inside.
2. Remove every `toDollars()` / `isValueInThousands` call at call sites.
3. Add unit test (see F-02) verifying both pre- and post-2023-05-25 filings parse correctly.
**Acceptance.** `git grep isValueInThousands` returns only the one definition site and the unit test. Dashboard, filing detail, and backtest totals match current values within $1.

### F-02 · Test harness  ·  M
**Why.** Backtest math has shipped bugs (commit `ce8f549`). Coverage is zero.
**Files.** New: `vitest.config.ts`, `src/lib/**/*.test.ts`, `tests/fixtures/` (frozen XML samples for 5 filings).
**Approach.**
1. Add Vitest (works with Next.js 16; avoid Jest).
2. Golden-file tests for `parse-13f.ts` (one pre-2023-05-25 filing, one post; one with confidential treatment; one amendment; one with options).
3. Snapshot test for `runBacktest` on Berkshire's last 4 quarters with frozen Yahoo data.
4. CI: GitHub Action running `npm test` on PR.
**Acceptance.** Tests pass on `main`; PR template auto-blocks if tests fail.

### F-03 · Reference data service  ·  M
**Why.** Sector views, market-cap-aware sorting, "% of float owned," and ETF detection all depend on this. Build it once, use everywhere.
**Files.** New: `src/lib/refdata.ts`, `src/data/refdata/securities.json` (build artifact).
**Approach.**
1. Define schema: `{ cusip, ticker, cik, name, gicsSector, gicsIndustry, isEtf, isAdr, sharesOutstanding, sharesAsOf, marketCap }`.
2. Source: SEC's [company tickers JSON](https://www.sec.gov/files/company_tickers.json) + OpenFIGI for CUSIP→ticker (already used) + a daily fetch of shares-outstanding from EDGAR's XBRL facts API (free).
3. GICS is the only paid piece; bootstrap with a hand-tagged top-3000 list from a CSV (Wikipedia S&P 1500 + Russell 2000 = ~3000 names, ~1 hour to scrape/clean).
4. Build script `scripts/build-refdata.ts`, snapshot file checked into `src/data/`.
5. `refdata.get(cusip)` is a synchronous Map lookup.
**Acceptance.** ≥90% of holdings across the 9 marquee funds resolve a sector tag. Build artifact regenerates in <30s.

### F-04 · Persistent cache for EDGAR + Yahoo  ·  M
**Why.** Already flagged in README. Required before universe expansion (Phase 4).
**Files.** `src/lib/disk-cache.ts` (modify), new `src/lib/kv.ts`.
**Approach.**
1. Wire Vercel KV (Upstash Redis) behind an interface — local dev keeps the current `.cache/` disk path.
2. Cache layers: EDGAR submissions (1h TTL), EDGAR holdings XML (forever — content-addressed by accession), Yahoo prices (24h TTL).
3. Read-through pattern: hit KV, fall back to live, write back to KV.
**Acceptance.** Cold leaderboard load on Vercel completes <5s. No regression in local dev.

### F-05 · Build-time aggregation job  ·  L
**Why.** At 50+ funds the dashboard cold path blows Vercel's 60s timeout. Snapshots solve performance pages; we need the same pattern for dashboard data.
**Files.** New: `scripts/build-snapshots.ts` (extends existing snapshot infra), `src/data/dashboard-snapshot.json`.
**Approach.**
1. Cron-able script that produces all dashboard data (latest filing per fund, QoQ diffs, cross-fund move buckets).
2. CI: weekly scheduled GH Action regenerates and commits the snapshot. Manual `npm run snapshots` for ad-hoc.
3. Page reads snapshot synchronously; `getAllFundDiffs()` becomes a memoized JSON read.
**Acceptance.** `/dashboard` first-paint <500ms on Vercel cold. New filings appear within 24h of EDGAR publication.

---

## Phase 1 — Quick Wins (ship visible value fast)

Eight items, each S or low-M. Order them however; none depend on each other beyond Phase 0.

### QW-01 · `/stock/[ticker]` page — cross-fund stock view  ·  M
**Why.** #1 missing allocator workflow. Highest user-value-per-engineering-hour item in the plan.
**Files.** New: `src/app/stock/[ticker]/page.tsx`, `src/lib/stock-view.ts`. Update header nav in `src/app/layout.tsx`.
**Approach.**
1. Input route: `/stock/AAPL` (resolve via refdata; fallback to `/stock/cusip/037833100`).
2. Server component: iterate `MARQUEE_FUNDS`, find each fund's latest holding of that CUSIP, plus the QoQ delta, plus a multi-quarter timeline of share counts.
3. Sections:
   - Header: ticker, issuer, current price (Yahoo), GICS sector.
   - Aggregate exposure: line chart of total $ across funds over time.
   - Holders table: fund / shares / % of fund / QoQ Δshares% / first bought / last add. Sortable.
   - New buyers this quarter / exits this quarter callouts.
   - % of float owned (collectively) if `sharesOutstanding` available.
   - Optional: price chart with markers at fund entry/exit dates.
4. Search input integration: typing a ticker in `SearchInput` offers "Stock: AAPL" alongside fund matches.
**Depends on.** F-03 (refdata).
**Acceptance.** `/stock/AAPL` renders ≤1s, shows all 9 funds' AAPL exposure across all quarters in their snapshot history.

### QW-02 · "% of portfolio change" ranking on dashboard  ·  S
**Why.** Berkshire's $1B AAPL trim and a $50M Citadel rotation are very different signals; dollar-only ranking conflates them.
**Files.** `src/components/cross-fund-highlights-view.tsx`, `src/lib/dashboard.ts`.
**Approach.**
1. Add `valueOfPct?: (m: Move) => number` to the `Section` type.
2. Add a UI toggle (`Dollar | % of portfolio`) above each section.
3. Compute `deltaWeightPct = (currentWeight - prevWeight)`.
**Acceptance.** Toggle reranks the visible list correctly. No values change when toggle is "Dollar."

### QW-03 · CSV export on holdings & highlights  ·  S
**Why.** Allocators will want spreadsheet data. Table view satisfies 80% of "give me the data" requests.
**Files.** `src/components/holdings-table.tsx`, `src/components/cross-fund-highlights-view.tsx`, new `src/lib/csv.ts`.
**Approach.**
1. `toCSV(rows: object[]): string` — handles quoting and commas.
2. "↓ Export CSV" button next to the existing filter input. `Blob` + `<a download>` client-side.
3. Filename: `13f-{fundName}-{quarter}.csv` / `13f-moves-{date}-{section}.csv`.
**Acceptance.** Export from holdings table reproduces the on-screen filter/sort in a CSV that opens cleanly in Excel and Google Sheets.

### QW-04 · "Tracked here" tag in search results  ·  S
**Why.** Fixes the search → dead-end UX gap.
**Files.** `src/app/search/page.tsx`, `src/lib/dashboard.ts`.
**Approach.**
1. Import `MARQUEE_FUNDS`; build a `Set<string>` of CIKs.
2. Show a small "★ Tracked" pill on matching result rows. Pill links to `/fund/{cik}/performance` instead of `/fund/{cik}`.
**Acceptance.** Searching "berkshire" shows Berkshire row with the star pill; searching "carl icahn" doesn't.

### QW-05 · Freshness timestamp  ·  S
**Why.** No way to tell if data is from 4 hours or 4 weeks ago.
**Files.** `src/app/dashboard/page.tsx`, `src/lib/dashboard.ts`, `src/data/dashboard-snapshot.json` (from F-05).
**Approach.**
1. Embed `lastBuildAt` in the dashboard snapshot.
2. Render "Last sync: 4h ago · Next expected filing: Berkshire (Aug 14)" in the dashboard header. Use `Intl.RelativeTimeFormat`.
3. Compute next expected filing date = quarter-end + 45 days for the fund with the most recent quarter-end.
**Depends on.** F-05.
**Acceptance.** Timestamp updates after each snapshot build. Next-expected-filing date is correct vs SEC's quarterly schedule.

### QW-06 · Max drawdown + Sharpe on performance page  ·  M
**Why.** Cheapest, highest-credibility analytical addition. Math is fully derivable from the existing daily equity curve.
**Files.** `src/lib/backtest.ts` (extend `stats`), `src/app/fund/[cik]/performance/page.tsx`, `src/lib/snapshots.ts` (regenerate).
**Approach.**
1. Add to `BacktestStats`:
   - `maxDrawdownPct`, `maxDrawdownStart`, `maxDrawdownTrough`, `maxDrawdownRecovered` (or null).
   - `volAnnualPct` (daily stddev × √252).
   - `sharpe = (mirrorCagr - rf) / volAnnualPct`; default `rf = 0.04`.
   - `sortino` (downside vol only).
   - `betaVsSpy` (cov(daily mirror, daily SPY) / var(daily SPY)).
   - `informationRatio` and `trackingError`.
   - `winRateQuarterly`, `upsideCapture`, `downsideCapture`.
2. Regenerate snapshots; add new stat tiles to performance page.
3. Tooltip on each metric explaining the formula.
**Depends on.** F-02.
**Acceptance.** Berkshire's reported maxDD matches industry sources within 1% (cross-check vs publicly reported Berkshire equity portfolio drawdowns). Sharpe is sensibly positive; vol >0; beta within 0.5–1.5 range.

### QW-07 · Fix Baupost suggestion mismatch  ·  S
**Why.** Trivial UX bug; high embarrassment factor.
**Files.** `src/app/page.tsx`, OR `src/lib/dashboard.ts`.
**Approach.** Either: add Baupost (CIK 1061165) to `MARQUEE_FUNDS` and ship its snapshot, OR remove from `SUGGESTIONS`. Prefer the former — Baupost is high-signal and slow-turnover.
**Acceptance.** Every landing-page suggestion leads to a fund with backtest + dashboard card.

### QW-08 · "Top 10 current holdings" on `/fund/[cik]`  ·  S
**Why.** Fund overview today forces an extra click to see what they own.
**Files.** `src/app/fund/[cik]/page.tsx`, `src/lib/dashboard.ts` (reuse `getFundDiff`).
**Approach.** Below the filings list, render a 10-row mini-table of current latest filing's top holdings by value. Sticky thumbnails for top-3 issuers (lazy).
**Acceptance.** Renders in same request as the filings list (no additional fetch). Each row links to the filing detail at that position's anchor.

---

## Phase 2 — Cross-Sectional Analytics

The "13F intelligence platform" wedge. Each item makes the product fundamentally more useful for an allocator vs a single-fund inspection tool.

### CS-01 · Consensus / crowding view  ·  L
**Why.** Goldman's "Hedge Fund VIP List" is the most-cited 13F derivative. Currently zero coverage.
**Files.** New: `src/app/consensus/page.tsx`, `src/lib/consensus.ts`. Update header nav.
**Approach.**
1. Aggregate across all `MARQUEE_FUNDS`:
   - For each CUSIP this quarter: count of funds holding, sum of dollars, count of funds new this quarter, count of funds exited.
   - Crowding score: `sum(weight_i)` over all funds (capped at 1.0 — proxy for "% of total tracked capital in this name").
2. Sections:
   - **Most-owned stocks** (top by fund count, ties broken by dollars).
   - **New consensus buys** (≥3 funds newly opened this quarter).
   - **Consensus exits** (≥3 funds fully sold).
   - **High disagreement** (≥2 buyers AND ≥2 exiters same name).
   - **Quiet accumulation** (held by fewer than 3 funds but each one added meaningfully).
3. Each row links to `/stock/[ticker]` (QW-01).
**Depends on.** QW-01, F-03, F-05.
**Acceptance.** Page renders in <1s. Manually verify the top 5 most-owned stocks match `MARQUEE_FUNDS` holdings union.

### CS-02 · Sector lens on dashboard + sector heatmap  ·  M
**Why.** Net sector flows are how every prime broker reports hedge fund positioning. Currently unrepresented.
**Files.** `src/lib/dashboard.ts`, `src/components/cross-fund-highlights-view.tsx`, new `src/app/dashboard/sectors/page.tsx`.
**Approach.**
1. Use F-03 to tag every holding with GICS sector.
2. Add a `sectorFilter` state to dashboard cross-fund sections.
3. New sub-page `/dashboard/sectors`: 11×9 grid (sectors × funds) with cell color = QoQ Δ portfolio weight. Hover for details.
4. Add "Net flows by sector" aggregate at top: bar chart of total $ added vs trimmed per sector across all funds.
**Depends on.** F-03.
**Acceptance.** Sector heatmap renders all 9 funds for the latest quarter; greens/reds correlate with the per-fund move data.

### CS-03 · Compare two funds  ·  M
**Why.** Allocators constantly cross-reference: "what do Pershing and ValueAct disagree on?"
**Files.** New: `src/app/compare/page.tsx`.
**Approach.**
1. Two fund pickers (URL params `?a=1067983&b=1336528`).
2. Sections:
   - Overlap matrix: common holdings sorted by joint dollar exposure.
   - Diverging positions: in A, not in B (top 20 by value).
   - Diverging positions: in B, not in A (top 20).
   - Same-name disagreement: held by both but one is adding and other trimming.
   - Sector overlap bar chart (uses F-03).
**Depends on.** F-03.
**Acceptance.** Compare Berkshire vs Pershing: ≥1 common holding found, both diverging-positions lists non-empty, sector chart readable.

### CS-04 · Position lineage view  ·  M
**Why.** Without multi-quarter trajectory, every QoQ delta is an isolated headline. Real signal is in the path.
**Files.** New component `src/components/position-lineage.tsx`; used by `/stock/[ticker]` and a new "View lineage" link on filing detail.
**Approach.**
1. Inputs: `(cik, cusip)`. Iterate all filings; produce `{ date, shares, valueUsd, weightInPortfolio }` series.
2. Chart: dual-axis — shares as a bar series, fund's weight % as a line. Yahoo price as a thin overlay.
3. Annotations: first buy, biggest add, biggest trim, exit (if any).
**Depends on.** QW-01.
**Acceptance.** Berkshire AAPL lineage chart shows the well-documented Q1 2024 trim and Q3 2024 trim with correct directions.

### CS-05 · Dashboard subset filter  ·  S
**Why.** "Show me only what activists are doing this quarter."
**Files.** `src/app/dashboard/page.tsx`, `src/lib/dashboard.ts`.
**Approach.**
1. Add a style/cohort tag to each fund in `MARQUEE_FUNDS` (`activist | tigerCub | quant | value | macro | smid`).
2. Add a multi-select control at the top of the dashboard. Persist selection in URL (`?cohort=activist,value`).
3. Filter all cross-fund sections by selected cohorts.
**Depends on.** Phase 4 partially (need ≥3 funds per cohort to be useful).
**Acceptance.** With "activist" selected, only activist funds' moves appear; counts decrement correctly.

### CS-06 · Filtering & sorting on filing detail page  ·  S
**Why.** Holdings table is sortable but can't filter by changeType. "Show me only new positions" is a common request.
**Files.** `src/components/holdings-table.tsx`.
**Approach.** Add a `changeType` filter (chips: All / New / Increased / Decreased / Unchanged). Remove the `slice(0, 8)` cap on exited positions; make exited a sortable, paginated table.
**Acceptance.** Filter chips correctly subset the table; export (QW-03) respects them.

---

## Phase 3 — Risk-Adjusted Analytics

Fund-level honesty. The leaderboard and backtests become defensible to a sophisticated audience.

### RA-01 · Drawdown plot on performance page  ·  S
**Why.** PMs and allocators care about drawdown as much as terminal return.
**Files.** New: `src/components/charts/drawdown.tsx`. Update `src/app/fund/[cik]/performance/page.tsx`.
**Approach.** Compute running peak from `equityCurve`; plot underwater curve (`current / peak - 1`) shaded red. Add to performance page below the equity curve.
**Depends on.** QW-06.
**Acceptance.** 2008 and 2020 drawdowns clearly visible on Berkshire mirror.

### RA-02 · Rolling 1-year alpha series  ·  M
**Why.** "Beat SPY by 50% over 15 years" hides whether the alpha came in 2002 or last quarter.
**Files.** `src/lib/backtest.ts`, new `src/components/charts/rolling-alpha.tsx`, performance page.
**Approach.** From the daily equity curves, compute trailing-252d return for mirror and SPY; plot `mirror_return_252 - spy_return_252` as a step series. Mark the average and the latest value.
**Depends on.** QW-06.
**Acceptance.** Renders on all 9 fund pages; chart shows non-trivial variation over time.

### RA-03 · Benchmark switcher  ·  M
**Why.** Bridgewater vs SPY is the wrong question. Renaissance vs SPY is also wrong (they're not running a US-equity long book at the scale 13F reports).
**Files.** `src/lib/prices.ts`, `src/lib/backtest.ts`, performance page, leaderboard, follower backtest.
**Approach.**
1. Allow benchmark tickers: SPY, IWM, QQQ, EFA (international), AGG (bonds), 60-40 (synthetic). Pull each via Yahoo.
2. Replace hardcoded `spy*` fields with `benchmark*` keys; store benchmark choice as URL param.
3. Compute alpha/beta/IR vs *each* benchmark on backtest run; render selected one.
**Depends on.** QW-06.
**Acceptance.** Switching benchmark on Bridgewater's performance page produces different but internally-consistent stats (mirror final stays the same; alpha changes).

### RA-04 · Cohort-normalized leaderboard  ·  M
**Why.** 8-quarter snapshots vs full-history funds on the same axis is misleading. Fix structurally.
**Files.** `src/components/leaderboard.tsx`, `src/lib/snapshots.ts`.
**Approach.**
1. Two leaderboards: "Last 8 quarters" (all funds normalized to most recent 8Q window) and "Full history" (only funds with ≥20Q snapshots).
2. Default tab to "Last 8 quarters."
3. Sortable: terminal return, CAGR, Sharpe, alpha, max drawdown.
**Depends on.** QW-06, F-05.
**Acceptance.** Both leaderboards render; "Last 8 quarters" includes all 9 funds; "Full history" excludes Renaissance/Citadel/Two Sigma/Soros.

### RA-05 · Transaction-cost overlay on backtests  ·  M
**Why.** Without this, the follower/conviction returns are upper-bound fictions.
**Files.** `src/lib/backtest.ts`, `src/lib/follower-backtest.ts`, `src/lib/conviction-backtest.ts`.
**Approach.**
1. Add slippage model: 5 bps default on each side, configurable.
2. Add tax drag toggle: long-term cap gains 23.8%, short-term 40.8%. Apply to closed P&L based on hold duration.
3. Surface both gross-and-net headline numbers; default to net.
**Acceptance.** Net returns are 10–25% lower than gross for high-turnover funds (Citadel, Two Sigma); minimal difference for Berkshire.

### RA-06 · T+N execution sensitivity table  ·  S
**Why.** Filing-date pricing is theoretical earliest entry. Real-world execution decays alpha.
**Files.** `src/app/backtest/follower/page.tsx`, `src/lib/follower-backtest.ts`.
**Approach.** Compute follower backtest at T+0, T+1, T+3, T+5, T+10, T+20 entry lags. Display as a small table: lag / total return / alpha / Sharpe.
**Acceptance.** Returns generally monotonically decrease as lag grows (this would be the realistic confirmation that disclosure-day alpha is non-trivial).

### RA-07 · Factor decomposition  ·  L
**Why.** "Renaissance has alpha" vs "Renaissance is long quality + low-vol" — currently indistinguishable.
**Files.** New: `src/lib/factors.ts`, `src/app/fund/[cik]/performance/page.tsx`.
**Approach.**
1. Download Fama-French daily factors from Ken French data library (free; one zip file per factor model).
2. Regress mirror daily excess return on factors: Mkt-RF, SMB, HML, MOM, optionally QMJ and BAB.
3. Report loadings with t-stats; alpha = intercept (annualized).
4. Visual: bar chart of factor loadings, separating "factor return contribution" from "alpha."
**Depends on.** RA-03 (benchmark infrastructure).
**Acceptance.** Berkshire shows positive HML loading (value tilt), Berkshire alpha is positive and statistically significant. Renaissance shows lower factor loadings (true alpha).

### RA-08 · Conviction-page methodology fixes  ·  M
**Why.** Current conviction = duration; doesn't weight by portfolio size.
**Files.** `src/lib/conviction-backtest.ts`, `src/components/conviction-view.tsx`.
**Approach.**
1. Add second dimension: minimum portfolio weight. Make the slider 2D (or add a second slider).
2. Replace "conviction = quarters held" with "conviction = quarters held × average portfolio weight" as the default sort.
3. Add "buy-and-hold-but-cap-at-fund-exit" mode alongside the existing "hold to today" mode.
**Acceptance.** Filter combos produce sensible smaller sets; the 2D filter at ≥4Q AND ≥2% weight yields a defensible "high-conviction picks" universe.

---

## Phase 4 — Universe Expansion

Coverage. Higher signal density makes every other phase more useful.

### UE-01 · Expand `MARQUEE_FUNDS` to 30 funds  ·  L
**Why.** Cohort filters (CS-05), consensus views (CS-01), and factor decomposition all need ≥3 funds per cohort.
**Files.** `src/lib/dashboard.ts`, `src/data/marquee-funds.ts` (extract).
**Approach.**
1. Curate target list with style tag and notes (see §2 of Part I for candidate list).
2. For each new fund: resolve CIK, verify 13F filing history, run snapshot generator.
3. Heavy funds: explicitly mark 8Q-snapshot strategy.
4. Add "About this fund" metadata: founder, founded, AUM (approximate), strategy description, style tag.
**Depends on.** F-04, F-05.
**Acceptance.** Dashboard renders all 30 funds; leaderboard sorts cleanly; consensus page sees richer signals.

### UE-02 · Universe page  ·  S
**Why.** With 30 funds, the dashboard cards-grid scales poorly.
**Files.** New: `src/app/universe/page.tsx`.
**Approach.** Table of all tracked funds: name, style tag, AUM (13F value), positions count, last-quarter Δvalue %, link to fund page. Filterable by tag; sortable by every column.
**Depends on.** UE-01.
**Acceptance.** All tracked funds listed; tag filter works; click-through to fund page.

### UE-03 · Per-fund metadata + AUM-over-time sparkline  ·  S
**Why.** Allocators want context, not just numbers. "Is this fund growing or unwinding?" is one chart away.
**Files.** `src/app/fund/[cik]/page.tsx`, fund metadata schema.
**Approach.**
1. Schema: `{ description, founded, manager, style, headquarters, notes }` in `src/data/fund-meta.json`.
2. Render bio block at top of fund page.
3. Sparkline of total 13F value across all filings (already have the data).
**Depends on.** UE-01.
**Acceptance.** Every tracked fund has bio block; sparkline reflects historical filing values.

---

## Phase 5 — Adjacent Filings (high-leverage additions)

13F alone is quarterly long-only. The real positioning story is in adjacent filings.

### AF-01 · Schedule 13D/13G ingestion  ·  L
**Why.** Activist intent disclosed here, often before 13F.
**Files.** New: `src/lib/edgar-13dg.ts`, new `src/app/activism/page.tsx`, fund-page integration.
**Approach.**
1. EDGAR search by filer for `SC 13D` and `SC 13G` types.
2. Parse cover page (filer, target CIK, target name, % ownership, purpose-of-transaction text).
3. Surface on `/stock/[ticker]` as a banner ("Pershing Square owns 9.5% — filed 13D 2024-04-15").
4. Activism page: timeline of recent 13D filings across the universe.
**Depends on.** F-03, QW-01.
**Acceptance.** Recent 13D filings by Pershing, Elliott, Trian appear on the activism page within 48h.

### AF-02 · Form 4 insider overlay  ·  L
**Why.** Smart-money 13F + insider buying = compounding signal.
**Files.** New: `src/lib/edgar-form4.ts`. Integrate into `/stock/[ticker]`.
**Approach.**
1. EDGAR's recent Form 4 feed; parse XML (different schema than 13F).
2. Aggregate by issuer CIK; surface "net insider buying $X over last 30/90 days."
3. On `/stock/[ticker]`, show insiders' recent transactions as a side panel.
**Depends on.** QW-01.
**Acceptance.** Stock page shows correct insider net buying for a sample of known recent transactions.

### AF-03 · Form 13F amendment surfacing  ·  S
**Why.** Acknowledged in commit `99f0bb4` but no UI surface.
**Files.** `src/lib/edgar.ts`, fund overview page.
**Approach.** When an amendment (`13F-HR/A`) exists, group it visually under the original filing with an "amended on {date}" tag. Show both holdings sets accessibly.
**Acceptance.** Funds with known amendments (Berkshire has had a few) display them correctly grouped.

### AF-04 · NPORT-P integration (stretch)  ·  XL
**Why.** Monthly portfolios for registered funds — 3x the granularity of 13F.
**Files.** New: `src/lib/edgar-nportp.ts`.
**Approach.** Only available for `40 Act funds (mutual funds, ETFs). Most hedge funds don't file this. Useful for the few tracked-here registered names (e.g., Sequoia Fund). Defer unless universe expands to include more registered funds.
**Acceptance.** TBD.

---

## Phase 6 — Personalization

Once cross-sectional value is in, recurring engagement comes from notifications and personal state.

### P-01 · Watchlists  ·  M
**Why.** "I want to follow Berkshire, Pershing, and Greenlight only" is a basic ask.
**Files.** New: `src/lib/watchlist.ts` (localStorage MVP), header UI.
**Approach.**
1. localStorage-based watchlist (CIK list) — no auth needed for v1.
2. Sticky "Following" cohort in cohort filter (CS-05).
3. "Add to watchlist" star icon on fund cards and fund pages.
**Depends on.** CS-05.
**Acceptance.** Star persists across sessions; "Following" filter on dashboard works.

### P-02 · Stock watchlist  ·  S
**Why.** Same primitive applied to tickers.
**Files.** Extend `watchlist.ts`; `/stock/[ticker]` integration.
**Acceptance.** Star a stock; appears in a "My stocks" view.

### P-03 · Email alerts (stretch)  ·  L
**Why.** Closing the loop — "tell me when my fund files something significant."
**Files.** New: `src/lib/alerts.ts`, scheduled cron via Vercel.
**Approach.**
1. Cron polls EDGAR for new filings by watchlist CIKs (requires auth — see P-04).
2. When new filing parsed: detect material moves (e.g., new position >2% of portfolio, full exit of top-10 holding).
3. Email via Resend or Postmark.
**Depends on.** P-01, P-04.
**Acceptance.** Subscribe; receive a test alert when a tracked fund files.

### P-04 · Auth (Stytch / Clerk / Supabase)  ·  M
**Why.** Required for email alerts. Optional for watchlists.
**Files.** Provider-specific. Pick one based on free tier and complexity.
**Acceptance.** Login flow; user-keyed watchlists.

---

## Appendix A — Methodological Fixes & Polish

Smaller items that don't fit a phase cleanly but should ship somewhere along the way.

### A-01 · Tighten conviction page wording  ·  S
**Why.** "Actionable buy list" is on the edge of investment advice; tighten before scaling.
**Files.** `src/app/backtest/conviction/page.tsx`.
**Approach.** Replace "Currently-held picks" with "Currently-held positions" and add an inline "Research starting points, not recommendations" caveat. Get a one-line sign-off from a lawyer if available.

### A-02 · Promote material caveats to callouts  ·  S
**Why.** Caveats buried at the bottom are not seen.
**Files.** Each backtest page; reuse a `<Callout variant="caveat">` component.
**Acceptance.** Top-3 material caveats appear next to the headline numbers.

### A-03 · Survivorship-bias disclosure  ·  S
**Why.** The 9 (or 30) funds are famous names. Returns are biased upward.
**Files.** Backtest pages.
**Approach.** Add a sentence to caveats and a methodology link.

### A-04 · Options notional/delta-adjusted view  ·  M
**Why.** Treating put notional as bearish exposure is wrong; calls can be income trades, not bullish bets.
**Files.** `src/lib/parse-13f.ts` (extract strike/expiry where available), `src/lib/dashboard.ts`, options sections.
**Approach.** Where strike and expiry are filed (not always — see SEC 13F instructions), compute delta-adjusted notional via Black-Scholes. Where not filed, show "notional approximated" label.

### A-05 · Centralized "filter the holdings table" toolbar  ·  S
**Why.** Cleaner UX for the changeType filter + search input + export button.
**Files.** `src/components/holdings-table.tsx`.

### A-06 · YoY comparison toggle on filing detail  ·  S
**Why.** Fundamental managers think in 4Q changes, not 1Q.
**Files.** `src/app/fund/[cik]/[accession]/page.tsx`.
**Approach.** Add a "vs 4Q ago" toggle that swaps `prevFiling` for the filing four positions back in `fund.filings`.

### A-07 · Accessibility audit  ·  M
**Why.** Tabular data with color-tone semantics needs ARIA labels and a non-color signal for screen readers.
**Files.** Across the board.
**Approach.**
1. Run Axe / Lighthouse on each page.
2. Add `aria-label`s to sortable headers, color-coded values (add "+/−" prefix where not present), and chart components.
3. Verify tab order and focus visibility.

### A-08 · Mobile review  ·  M
**Why.** No explicit mobile design exists; assess and fix worst offenders (holdings table, dashboard grid, leaderboard sparklines).

### A-09 · Print stylesheet  ·  S
**Why.** Allocators print holdings pages.
**Files.** `src/app/globals.css`.

### A-10 · Reverse-search: CUSIP / ticker in main search  ·  S
**Why.** Searching `037833100` or `AAPL` should land on `/stock/[ticker]`.
**Files.** `src/components/search-input.tsx`, `src/app/search/page.tsx`.
**Depends on.** QW-01.

---

## Appendix B — Risks & Open Questions

- **Yahoo Finance rate limiting and data quality** at the scale of a 30+ fund universe is unproven. May need a paid market data feed (Polygon ~$30/mo, Tiingo ~$10/mo) before Phase 4.
- **OpenFIGI rate limiting** is mitigated by API key (already documented) but still a bottleneck for snapshot regeneration. Cache aggressively (F-04 helps).
- **GICS data licensing**: a free hand-curated mapping (F-03) covers ~3000 names. If we want full coverage of small caps, this becomes either expensive (~$5k/yr for an industry feed) or labor-intensive.
- **Storage cost** of historical snapshots grows linearly with universe size × history depth. Plan for ~50 MB per snapshot at 30 funds; Vercel KV pricing scales acceptably.
- **Legal disclaimer scope** — once email alerts (P-03) ship, the product looks more like investment guidance than research. Tighten ToS/disclaimer language.

---

## Appendix C — Sequencing Summary

A reasonable order for one engineer ~full-time:

| Week | Focus |
|---|---|
| 1–3 | Phase 0 (F-01 through F-05) — foundations |
| 4–5 | Phase 1 (QW-01 through QW-08) — visible quick wins |
| 6–10 | Phase 2 (CS-01 through CS-06) — cross-sectional views |
| 11–14 | Phase 3 (RA-01 through RA-08) — risk-adjusted analytics |
| 15–18 | Phase 4 (UE-01 through UE-03) — universe expansion |
| 19–24 | Phase 5 (AF-01 through AF-03) — adjacent filings |
| 25–28 | Phase 6 (P-01 through P-04) — personalization |
| Ongoing | Appendix A items as filler between large items |

**Earliest meaningful release**: end of Week 5 (Phase 0 + Phase 1) ships a measurably stronger product. **Wedge-defining release**: end of Week 10 (Phase 2) — `/stock`, consensus, sector lens, compare. **Defensible-vs-paid-competitors release**: end of Week 14 (Phase 3) — risk-adjusted backtests + factor decomposition.
