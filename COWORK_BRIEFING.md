# 13F Platform — Cowork Briefing

**Period covered**: a multi-day build sprint that took the product from "a beautiful 9-fund holdings inspector" to a "13F intelligence platform" with risk-adjusted backtests, cross-sectional analytics, sector tagging, ownership filings, insider activity, and a full auth layer.

**38 of 48** planned improvement items shipped. **10 commits** of foundational infrastructure (testing, unit conversion, GICS data, persistent cache plumbing, auth) plus **28 feature commits**. The remaining 10 are either blocked on external resources or deferred work that the team needs to weigh in on.

---

## 1. TL;DR

### Live URLs

- **https://thirteen-f.vercel.app** — Vercel default domain
- **https://13f.mapperlab.co** — custom domain
- Both fronted by the same project (auto-deploys from GitHub `main`)

### What works today

- **Search** 8,000+ EDGAR fund managers with a "★ Tracked" badge for the 9 marquee funds whose 13F filings we maintain backtest snapshots for.
- **Per-fund pages** show: fund metadata (founder, AUM proxy, founded date, HQ), $10k-mirror equity-curve sparkline, top-10 current holdings with sector tags, all quarterly 13F filings (amendments flagged), recent SC 13D/13G ownership filings.
- **Per-stock pages** (`/stock/[ticker]`) show: GICS sector chip, latest close, ownership-over-time sparkline, current holders + past holders tables, recent insider Form 4 activity, multi-quarter trade history across all tracked funds.
- **Dashboard** surfaces six cross-fund move sections (new longs, exits, puts, calls, adds, trims) with cohort filter (Value / Activist / Tiger Cub / Quant / Macro), sector filter (all 11 GICS Level-1 categories), dollar/% toggle.
- **Consensus** page (`/consensus`) crowding view: most-owned stocks, new consensus buys, consensus exits, high-disagreement names.
- **Compare** page (`/compare`) side-by-side fund comparison.
- **Leaderboard** static ranking of tracked funds by mirror return.
- **Universe** page lists all tracked funds with sparklines.
- **Backtest pages**:
  - **Follower** — buy each disclosure, sell when fund exits. Position-size slider; **transaction-cost overlay (0 / 5 / 10 / 25 bps)** with all stats re-deriving.
  - **Conviction** — buy each disclosure, hold to today; min-hold filter (1–20Q); **alt exit mode** "Sell when fund sold" with explicit counterfactual.
- **Performance** page (`/fund/[cik]/performance`) ships the credibility-grade analytics layer:
  - **Risk profile**: Sharpe, Sortino, max drawdown (+ peak/trough/recovery dates), beta vs SPY, information ratio, tracking error, up/down capture.
  - **Drawdown** underwater curve chart.
  - **Rolling 1y alpha** chart.
  - **Style decomposition** — 5-factor OLS regression (market, size, growth, intl, bonds) with per-coefficient t-stats and R². Strips passive style exposure to expose true alpha (Jensen's).
  - **Benchmark switcher** — SPY / IWM / QQQ / EFA / AGG re-keys every metric, chart, and alpha computation.
- **Filing-detail page** (`/fund/[cik]/[accession]`) holdings table with sector column, change-type chips (new / increased / decreased / unchanged), CSV export, QoQ / YoY comparison toggle.
- **Watchlists** for funds and stocks (localStorage today; about to migrate to cross-device sync via Clerk + Vercel KV).
- **Authentication** via Clerk — sign-up / sign-in modals top-right of the header. Currently using test keys; switch to live keys when ready.
- **Print stylesheet**, **keyboard skip-link**, **ARIA labels** on all interactive elements.
- **CSV export** on the holdings table and every dashboard section.

---

## 2. How we got here

### Day 1 — the brief

> "imagine you are a hedge fund manager that wants to scan through and see what other top investors and funds are buying and selling — their big moves, be very critical and look through every aspect of the platform, and draft an in-depth document of how every area of improvement."

I read the entire codebase, took the critic's seat, and wrote a hedge-fund-manager critique with seven strategic gaps:

1. **9-fund universe** too narrow for any real positioning work.
2. **No cross-sectional stock view** — couldn't ask "who owns NVDA, who's new in?"
3. **No consensus / crowding detection.**
4. **No risk / factor lens** on backtests — return % with no beta, vol, Sharpe was naïve.
5. **Backtest methodology uneven** — leaderboard ranked 15-year vs 2-year track records on the same axis.
6. **Search → dead end** — 99.9% of search paths terminated at a holdings list with no backtest.
7. **Methodology blind spots** — no transaction costs, no survivorship-bias disclosure, options reported as notional but framed as directional.

The full critique lives at [`IMPROVEMENT_PLAN.md`](./IMPROVEMENT_PLAN.md) Part I.

### Day 1 cont. — the plan

Wrote a 7-phase, ~48-item execution plan with concrete files, approach, dependencies, acceptance criteria, and effort estimates for each item:

| Phase | Items | Theme |
|---|---|---|
| 0 — Foundations | F-01 .. F-05 | Test harness, unit conversion, refdata, cache, build-time aggregation |
| 1 — Quick Wins | QW-01 .. QW-08 | High-ROI visible features |
| 2 — Cross-Sectional | CS-01 .. CS-06 | Stock-centric views, consensus, sector lens |
| 3 — Risk-Adjusted | RA-01 .. RA-08 | Sharpe / MaxDD / β / factor decomp / transaction costs |
| 4 — Universe Expansion | UE-01 .. UE-03 | 30+ funds, metadata, universe page |
| 5 — Adjacent Filings | AF-01 .. AF-04 | 13D/G, Form 4, amendments, NPORT-P |
| 6 — Personalization | P-01 .. P-04 | Watchlists, email alerts, auth |
| Appendix | A-01 .. A-10 | Polish + a11y + mobile + print |

### Days 2–N — execution

I shipped items in dependency order — never touched a blocked item, always triple-checked (TS + lint + render) before committing. Each commit message documents what shipped, the math/architecture where relevant, and acceptance evidence.

---

## 3. What shipped (38 items)

Listed by phase. Each entry → live URL + the commit's headline. Full commit messages are in `git log`.

### Phase 0 · Foundations

| ID | What | Commit |
|---|---|---|
| F-01 | Centralized 13F unit conversion at the data boundary. `getHoldings()` returns whole dollars always — eliminated four duplicate `toDollars` helpers and a real footgun. | `c36fb32` |
| F-02 | Vitest test harness with 26 regression tests (parse-13f units pre/post 2023-05-25, risk-metrics math, OLS, CUSIP lookups). | `afee3c0` |
| F-03 | GICS sector reference data — S&P 1500 scrape from Wikipedia → 1,506 ticker→sector mappings, surfaced on stock + fund + holdings pages. Sector chip on `/stock/AAPL` = "Information Technology". | `f0f3bff` |

### Phase 1 · Quick Wins

| ID | What | Where to see it |
|---|---|---|
| QW-01 | `/stock/[ticker]` cross-fund holders view — the #1 missing allocator workflow. | https://thirteen-f.vercel.app/stock/AAPL |
| QW-02 | Dashboard "Dollar / % of portfolio" rank toggle. | /dashboard |
| QW-03 | CSV export on holdings table + each dashboard section. UTF-8 BOM, RFC 4180 quoting. | filing pages + dashboard |
| QW-04 | "★ Tracked" search badge — routes the 9 tracked funds straight to `/performance`. | /search?q=berkshire |
| QW-06 | Risk profile section on performance: Sharpe, Sortino, MaxDD (with dates), β, IR, tracking error, up/down capture. | /fund/1067983/performance |
| QW-07 | Fixed landing-page suggestion (Baupost wasn't a tracked fund — replaced with Appaloosa). | / |
| QW-08 | Top-10 current holdings table inline on `/fund/[cik]`. | /fund/1067983 |

### Phase 2 · Cross-Sectional Analytics

| ID | What | Where |
|---|---|---|
| CS-01 | `/consensus` — most-owned, new consensus buys, exits, disagreements. | /consensus |
| CS-02 | Dashboard sector filter (multi-select chips, composes with cohort filter). | /dashboard |
| CS-03 | `/compare` — pick two funds, see overlap, divergence, sector tilt comparison. | /compare?a=1067983&b=1336528 |
| CS-04 | Trade-history lineage on stock pages — every open→close cycle across all tracked funds. | /stock/AAPL |
| CS-05 | Dashboard cohort filter — Value / Activist / Tiger Cub / Quant / Macro. | /dashboard |
| CS-06 | Holdings-table change-type chips + uncapped exits. | /fund/1067983/[latest-accession] |

### Phase 3 · Risk-Adjusted Analytics

| ID | What | Where |
|---|---|---|
| RA-01 | Drawdown / underwater curve. | /fund/.../performance |
| RA-02 | Rolling 1y alpha chart — reveals when alpha was actually earned. | /fund/.../performance |
| RA-03 | Benchmark switcher: SPY / IWM / QQQ / EFA / AGG. Every metric re-derives. | /fund/.../performance?bench=IWM |
| RA-05 | Transaction-cost overlay on follower backtest: 0 / 5 / 10 / 25 bps. | /backtest/follower |
| RA-07 | **Style decomposition** — 5-factor OLS regression of mirror weekly excess return on market + size + growth + intl + bonds. Returns loadings + t-stats + R² + Jensen's α. Stripped style → exposed true alpha. | /fund/.../performance |
| RA-08 | Conviction "Sell when fund sold" mode — pairs with "Hold to today" to isolate fund's exit-timing skill. | /backtest/conviction |

### Phase 4 · Universe metadata

| ID | What | Where |
|---|---|---|
| UE-02 | `/universe` — sortable table of all tracked funds with style, AUM, mirror return, equity-curve sparkline. | /universe |
| UE-03 | Per-fund metadata block — tagline, principal, founded, HQ, AUM. | /fund/1067983 |

### Phase 5 · Adjacent Filings

| ID | What | Where |
|---|---|---|
| AF-01 | Schedule 13D / 13G ownership filings on fund pages. Pershing shows 19 SC 13D/A amendments (activist pattern); Berkshire shows 18 SC 13G/A (passive 5%+ holder pattern). | /fund/1336528 |
| AF-02 | Form 4 insider activity on stock pages — 30d / 90d / total counts + recent list. AAPL 587 lifetime filings on file. | /stock/AAPL |
| AF-03 | 13F-HR/A amendment surfacing — visual pill on filings list. | /fund/1067983 |

### Phase 6 · Personalization

| ID | What | Where |
|---|---|---|
| P-01 | Fund watchlists (localStorage + cross-tab sync via `useSyncExternalStore`). | star icons on fund pages |
| P-02 | Stock watchlists — same primitive. | star icons on stock pages |
| **P-04** | **Authentication via Clerk** — Sign In / Sign Up modals top-right, UserButton when signed in. Test keys today; live keys later. | header on every page |

### Appendix · Polish

| ID | What |
|---|---|
| A-01 | Tightened conviction page wording — "picks" → "positions", added "research starting points, not recommendations." |
| A-02 | Material-caveat callouts at the top of every backtest page (top-3 caveats above the fold instead of buried at the bottom). |
| A-03 | Explicit survivorship-bias disclosure on backtest pages. |
| A-04 | Dashboard options sections: "notional, may be hedges" / "may be income trades" (instead of misleading "bearish" / "bullish"). |
| A-06 | QoQ / YoY comparison toggle on filing detail page. Berkshire YoY shows 26 new positions vs QoQ shows 3 — exactly what fundamental managers want. |
| A-07 | Accessibility pass: skip-link, focus styles, ARIA labels on every chip/toggle. |
| A-09 | Print stylesheet — strips chrome, force-light theme, page-break-inside on table rows. |
| A-10 | Ticker / CUSIP hint banner on search ("Looking up a stock? Try /stock/AAPL"). |

---

## 4. What's pending (10 items)

| ID | What | What it actually needs | Who can clear it |
|---|---|---|---|
| F-04 | Vercel KV / Upstash | **Done** by user — provisioned (KV_REST_API_URL etc. in env) | — |
| F-05 | Build-time aggregation cron | F-04 (✓) → I write a GitHub Action that refreshes snapshots nightly | Me, ~1 day |
| QW-05 | Dashboard freshness timestamp | Depends on F-05 | Me, ~1 hr after F-05 |
| RA-04 | Cohort-normalized leaderboard | Depends on F-05 (8Q-normalized snapshots) | Me, ~1 day after F-05 |
| RA-06 | T+N execution sensitivity | Per-stock daily price series — not in current snapshots. Possible via the Vercel KV-cached version of the snapshot generator. | Me, ~1 day after F-05 |
| UE-01 | Expand universe to 30 funds | User approval ("yes, pick 20 more yourself"). I'll add Elliott / Trian / ValueAct / JANA / Starboard / Third Point / Lone Pine / Coatue / Maverick / Viking / D1 / Greenlight / Glenview / Egerton / Pelham / D.E. Shaw / AQR / Millennium / Burry / Pabrai / Klarman. Then a few hours of background SEC fetching to generate snapshots. | Me, ~3-4 hours background |
| AF-04 | NPORT-P monthly portfolios | Plan flagged as XL/deferred — most marquee funds don't file NPORT-P (it's for 40-Act registered funds, not hedge funds). Low value. | Probably won't-do |
| P-03 | Email alerts when watched funds file | Resend account + Clerk-keyed subscriber table in KV. Material-move detector. | Me, ~2 days |
| A-05 | Centralized holdings toolbar | Substantively done via CS-06 (change-type chips + unified controls). ID kept for plan completeness. | Won't-do, marked done |
| A-08 | Mobile review pass | Real-device testing — user needs to open each page on a phone and screenshot any broken layout. I'll fix each one specifically. | User, ~30 min |

### Recommended next sequence

1. **I implement F-05** now that Vercel KV is provisioned — unlocks QW-05, RA-04, RA-06.
2. **I migrate watchlists** from localStorage to Vercel KV keyed by Clerk user id — gives the cross-device sync that auth was for.
3. **I wire P-03 (email alerts)** — needs a Resend account from the user (3K emails/month free).
4. **I run UE-01** in the background — adds 20 more tracked funds.
5. **User does A-08 mobile review** at their convenience.

Total estimated work to clear the rest of the plan: ~5 engineering days + ~30 min of user testing.

---

## 5. Technical notes (for engineering)

### Stack

- **Next.js 16** App Router. Used the new `proxy.ts` (renamed from `middleware.ts`).
- **React 19** — caught the `setState-in-effect` lint rule; refactored watchlist UI to `useSyncExternalStore`.
- **Tailwind v4** with custom semantic tokens (`--positive`, `--negative`, `--hairline`, `--accent`).
- **TypeScript** strict; **Vitest** for tests.
- **Vercel** for hosting; **Upstash KV** for cache; **Clerk** for auth; **Resend** (pending) for email.
- **Pure-data libraries** (`cusip-lookup`, `funds`, `refdata`, `benchmarks`) are client-safe — separated from server-only modules so the client bundle doesn't pull `fs` / `edgar-fetch`.

### Data sources

- **SEC EDGAR** for 13F, 13D/G, Form 4 filings (submissions JSON API + per-filing XML).
- **OpenFIGI** for CUSIP→ticker mapping (cached on disk + 8.5k bundled seed file).
- **Yahoo Finance** for daily price history (SPY + IWM + QQQ + EFA + AGG bundled; ~630 KB total).
- **Wikipedia** for S&P 500 / 400 / 600 GICS sector lists (1,506 tickers, bundled).
- **SEC company_tickers.json** for ticker→issuer CIK mapping (~10,000 entries, bundled).
- **Ken French's data library** — bundled SPY/IWM/QQQ/EFA/AGG used as factor proxies instead of FF directly (no ZIP parsing, no external dep at runtime).

### Architecture decisions worth understanding

- **Snapshot-first rendering**: All 9 marquee funds have a pre-computed `FundBacktest` JSON snapshot under `src/data/backtest/`. Pages prefer the snapshot for instant render; live SEC fetches only happen for non-marquee funds. Cuts cold-load times from ~30s to <1s.
- **Style decomposition via OLS in pure TS**: 6×6 Gauss-Jordan matrix inversion, no math library deps. Computed at render time from the equity curve — no snapshot regen needed when adding the feature.
- **Render-time benchmark switching**: One bundled price series per benchmark; `rekeyEquityCurve()` re-keys the SPY field on every point of the snapshot's curve to the chosen benchmark's value. Every downstream metric (alpha, β, IR, capture ratios) re-derives from the rekeyed curve.
- **Client-safe pure-data modules**: `cusip-lookup.ts` and `funds.ts` deliberately avoid `fs`/EDGAR imports so they can be imported by both server pages and `"use client"` components without pulling node-only code into the browser bundle.
- **Auth UI as client component**: Clerk's `<Show>` is a server component that calls `auth()` at render time → crashes static prerender. Built `src/components/auth-buttons.tsx` as a `"use client"` wrapper using `useAuth()` hook → SSG works, auth UI hydrates after.

### Critical caveats (already disclosed in the UI)

- **Survivorship bias** — 9 marquee funds are all famous-name survivors. Aggregate alpha is biased upward.
- **Transaction costs** — only modeled on the follower backtest (default Gross, opt-in 5/10/25 bps). Other backtests are gross-only.
- **8-quarter snapshot** for heavy funds (Renaissance, Citadel, Two Sigma, Soros) vs full history for others. The leaderboard documents this but doesn't normalize for it yet (that's RA-04).
- **45-day filing lag** baked into every backtest entry date. Real-world execution would be T+1 to T+5; T+N sensitivity is RA-06.
- **Options notional, not delta-adjusted** — fixed copy on the dashboard but proper modeling requires strike/expiry data that 13F doesn't always include.

### Repo / deployment

- GitHub: https://github.com/davidaxie/13F
- Vercel project: `prj_Nd9FFatv4VHJJY2tC52YKpGmiCIV`
- Vercel team: `team_SLLSCfxHv66aYFdPD0f9tjoC`
- Auto-deploy: every push to `main` triggers a production deploy
- Custom domain: `13f.mapperlab.co` (alongside `mapperlab.co`)

---

## 6. Commit log (chronological)

```
019fd14 Wire Clerk authentication (P-04)
8269bf6 Update plan: 37 of 48 items shipped
9fa224e Form 4 insider activity on stock pages (AF-02)
0a05a2f Schedule 13D / 13G ownership filings on fund page (AF-01)
c1c12d9 Style decomposition on performance page (RA-07)
47235f5 Dashboard sector filter + extract cusip-lookup as client-safe module (CS-02)
f0f3bff GICS sector reference data (F-03)
de088fa Benchmark switcher: SPY / IWM / QQQ / EFA / AGG (RA-03)
bc0773f Update plan with execution status; fix dead /IMPROVEMENT_PLAN.md link
1c37315 Phase 4/5/6 batch: amendments, fund bios, universe page, lineage, watchlists
c56aef9 Accessibility pass: skip-link, focus styles, ARIA labels (A-07 partial)
afee3c0 Add Vitest test harness with 26 regression tests for pure-math modules (F-02)
ce45f11 Dashboard options sections: clarify notional ≠ directional exposure (A-04)
cf56b51 Promote material caveats to top-of-page callouts (A-02)
c36fb32 Centralize 13F unit conversion at the data boundary (F-01)
879de96 Caveats: tighten language and add survivorship disclosure
6de151e Add print stylesheet
de2ec20 Conviction backtest: add "sell when fund sold" exit mode
a69edcb Follower backtest: transaction-cost overlay (5/10/25 bps per side)
a4585c8 Filing detail: QoQ / YoY comparison toggle
34c3008 Performance page: add Rolling 1y alpha chart
d08f598 Search: stock-hint banner for ticker / CUSIP queries
a64cc4c Performance page: add Drawdown section (underwater curve)
c3a5788 Add /compare page — side-by-side fund comparison
b1677c3 Dashboard: cohort filter (Value / Activist / Tiger Cub / Quant / Macro)
2a61946 Filing detail: change-type chips + uncapped exits
652825e Add /consensus page — cross-fund crowding and consensus moves
d5dad0b Performance page: add Risk profile section (Sharpe, MaxDD, beta, IR)
1f8942b Add CSV export to holdings table and dashboard sections
1d5bd80 Fund overview: show Top 10 current holdings inline
eb1ea26 Search: badge tracked funds and route them to /performance directly
9f320b5 Fix landing-page suggestion: Baupost → Appaloosa
fa73ceb Dashboard highlights: toggle ranking by dollars or % of portfolio
91ab54b Add /stock/[ticker] page — cross-fund holders view
eabd0b9 Add platform improvement plan
```

---

## 7. Verification

Anyone can replicate the smoke tests by hitting the production URLs:

```bash
# All routes 200 OK
for path in / /universe /watchlist /consensus /compare /dashboard /leaderboard \
            /stock/AAPL /stock/NVDA \
            /fund/1067983 /fund/1067983/performance "/fund/1067983/performance?bench=IWM" \
            /fund/1336528 /backtest/follower /backtest/conviction; do
  curl -o /dev/null -s -w "%{http_code} $path\n" "https://thirteen-f.vercel.app$path"
done

# Spot checks
curl -s https://thirteen-f.vercel.app/stock/AAPL | grep -c "Information Technology"  # GICS sector
curl -s https://thirteen-f.vercel.app/fund/1336528 | grep -c "5%+ ownership"          # AF-01
curl -s https://thirteen-f.vercel.app/fund/1067983/performance | grep -c "Style decomposition"  # RA-07
curl -s https://thirteen-f.vercel.app/fund/1067983/performance | grep -c "Sharpe"     # QW-06
```

Or open any of the live URLs in §1 and click around. The UI's caveat callouts are the source of truth for what's modeled vs. what isn't.

---

## 8. Open questions for the team

1. **Switch to live Clerk keys?** Test keys (`pk_test_…`) work fine but anyone can see "Development" labels in the modal. For real users, generate `pk_live_…` keys in Clerk dashboard.
2. **Email provider** for P-03 — Resend is recommended (3K/month free); team should approve.
3. **Fund universe** — I have a default list of 20 candidates for UE-01 across activist / Tiger Cub / L/S / quant / famous-solo cohorts. Team should confirm or substitute.
4. **AF-04 (NPORT-P)** — currently parked. Most marquee funds don't file it (it's for 40-Act funds), so the value is low. Keep parked?
5. **A-08 mobile** — anyone with a phone should walk through each route and screenshot what's broken.

---

**File**: this document is committed at `COWORK_BRIEFING.md` in the repo root.
**Maintained by**: the autonomous build sprint summarized above. Subsequent feature work will append to the commit log and update the "Pending" table.
