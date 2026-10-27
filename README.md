# 13F

A research platform for SEC Form 13F filings: what the big funds hold, what they just bought and sold, and what you would have made copying them.

## What it does

Every quarter, institutional managers with $100M+ in US equities disclose their long positions on Form 13F. This app pulls those filings straight from SEC EDGAR, with no third-party aggregator, and turns them into:

- **Fund pages**: every 13F a manager has filed, holdings with position value and % of portfolio, and quarter-over-quarter or year-over-year diffs (new, increased, decreased, exited). Also recent 13D/13G ownership filings, and CSV export.
- **Cross-fund views** across 27 curated funds (value, activist, Tiger Cub, quant, macro): a dashboard of the latest moves, a consensus page for the most crowded names and consensus buys and exits, a new-entries feed ranked by signal quality, and side-by-side fund comparison.
- **Stock pages**: which tracked funds hold a ticker, ownership over time, fundamentals from SEC XBRL, and recent insider (Form 4) filings.
- **Backtests**: a $10,000 "mirror" of each fund's disclosed book against SPY, plus two follower strategies, with transaction-cost overlays.
- **Performance analytics**: Sharpe, Sortino, max drawdown with recovery dates, beta, information ratio, tracking error, up and down capture, rolling one-year alpha, and a switchable benchmark (SPY, IWM, QQQ, EFA, AGG).
- **Accounts and alerts**: sign in to sync watchlists across devices, and get an email when a watched fund files.

## How it works

**EDGAR client** (`src/lib/edgar.ts`). Every SEC request goes through one process-wide queue spaced 105 ms apart, just under SEC's 10 requests a second, with retries. Parsed holdings are cached on disk by accession number with no expiry, because a filing never changes.

**The 13F unit trap.** Filings due before 25 May 2023 report values in thousands of dollars; later ones in whole dollars. The conversion happens once, at the data boundary. Each filing's total is also cross-checked against the cover page's `tableValueTotal`, which caught a residual 1000x error that slipped through the date rule.

**CUSIP to ticker.** 13Fs identify securities by CUSIP. A bundled seed of about 15,800 mappings, built from OpenFIGI and SEC's ticker file, means the app renders without calling OpenFIGI or needing an API key. Options rows are excluded so the mirror holds common stock only.

**Mirror backtest** (`src/lib/backtest.ts`). At each filing, the $10,000 portfolio rebalances to the fund's disclosed weights. Trades fill at the close on the **filing date**, when the data became public, not at quarter end, which a real follower could never trade on. The book is marked weekly against SPY. Snapshots for 25 funds are precomputed (`scripts/generate-all-snapshots.ts`), refreshed every Monday by a GitHub Action, and committed. The leaderboard and performance pages are therefore static, which keeps them inside Vercel's function time limits.

**Style decomposition** (`src/lib/factor-decomp.ts`). A five-factor regression of the mirror's weekly excess return on SPY, IWM minus SPY, QQQ minus SPY, EFA minus SPY and AGG minus SPY, with t-stats and R². It separates passive tilts (size, growth, international, bonds) from what is left over.

**Alerts** (`src/app/api/alerts/`). A GitHub Actions job calls the send endpoint hourly with a bearer secret, and the endpoint fails closed in production if the secret is unset. Per-fund "last seen filing" markers and per-user, per-filing dedup in Vercel KV make every run idempotent, so a retry cannot double-send. Unsubscribe links are HMAC-signed. Email goes out through Resend.

**Honest caveats in the UI.** 13F covers long positions only, arrives up to 45 days after quarter end, and the fund list has survivorship bias. These are shown as callouts on the pages they affect, and the methodology is on `/about`.

## Tech stack

TypeScript, Next.js 16 (App Router), React 19, Tailwind CSS v4, fast-xml-parser, yahoo-finance2, Clerk, Vercel KV, Resend, Sentry, Vitest, GitHub Actions, Vercel.

## Running locally

```bash
npm install
cp .env.example .env.local   # set EDGAR_USER_AGENT to "Your Name you@example.com" (SEC requires a contact)
npm run dev                  # http://localhost:3000
npm test                     # Vitest
```

Without Clerk keys the app runs in Clerk's keyless dev mode. Without Resend and `CRON_SECRET`, alerts are off. Without Sentry the SDK no-ops. `OPENFIGI_API_KEY` is optional and only speeds up lookups for CUSIPs missing from the bundled seed. Set `HTTPS_PROXY` if Yahoo Finance blocks your IP.

Regenerate the backtest snapshots:

```bash
EDGAR_USER_AGENT="Your Name you@example.com" npx tsx scripts/generate-all-snapshots.ts
```

## Notes on the data

- Prices are Yahoo Finance daily adjusted closes. Sector tags come from the S&P 500, 400 and 600 constituent lists on Wikipedia.
- Backtests are stylized: by default there are no transaction costs, no market impact, and no shorts. The follower pages add a 5, 10 or 25 bps per side cost overlay.
- For research only. Not investment advice.
