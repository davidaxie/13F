# 13F

An elegant, minimalist research tool for SEC Form 13F filings — the quarterly
reports that institutional investment managers (with $100M+ in qualifying
assets) file to disclose their U.S. equity holdings.

Data is pulled live from **SEC EDGAR** — no third-party API, no key required.

## Features

- **Search** any fund manager by name (uses EDGAR full-text search)
- **Browse** a manager's quarterly 13F filings in chronological order
- **Inspect** any filing's holdings: position values, % of portfolio, shares
- **Compare** quarter over quarter — new positions, exited positions, share-change %
- Designed for personal research with **tabular figures**, hairline rules, and a serif/sans pairing

## Stack

- Next.js 16 (App Router, RSC)
- React 19
- Tailwind CSS v4
- TypeScript
- `fast-xml-parser` for SEC information tables
- `lucide-react` for icons

## Setup

```bash
npm install
cp .env.example .env.local   # then edit with your name + email
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

| Var | Required? | Why |
| --- | --- | --- |
| `EDGAR_USER_AGENT` | yes | SEC fair-access policy. Format: `"Your Name your.email@example.com"`. |
| `OPENFIGI_API_KEY` | recommended | Without a key, OpenFIGI rate-limits CUSIP→ticker lookups to 25 req/min in batches of 10. With a free key, it's 100 req/min in batches of 100 (~40× faster). Critical for the leaderboard on Vercel. Get one at <https://openfigi.com/api>. |
| `HTTPS_PROXY` | dev only | Set when Yahoo Finance geo-blocks your IP (e.g. routing through ClashX or a similar proxy). Picked up by `src/instrumentation.ts`. |

### Production deployment

This is a Next.js App Router app — deploys cleanly to Vercel. Two caveats:

1. **Function timeouts.** The backtest engine fits Vercel Hobby's 60s limit
   for single-fund pages but the leaderboard's 9-fund cold start can exceed
   it. Pro plan's 300s ceiling removes the problem.
2. **Persistent cache.** Local dev caches to `.cache/`; Vercel caches to
   `/tmp`, which is per-container and resets on cold starts. For an
   always-fast leaderboard, wire a persistent store (Vercel KV / Upstash
   Redis) and have `lib/disk-cache.ts` read/write through that.

## Notes on 13F data

- **Value column units**: Filings due on or before **2023-05-25** report
  values in **thousands of dollars**; later filings report in **whole
  dollars**. The app handles this automatically.
- **Long positions only**: 13F covers long positions in 13(f)-securities. Short
  positions, cash, and most non-equity holdings are not reported.
- **45-day lag**: Filings are due 45 days after quarter-end, so holdings reflect
  a snapshot at quarter-end, not real-time positions.

## Project layout

```
src/
├── app/
│   ├── page.tsx                       Landing + search
│   ├── search/page.tsx                Manager search results
│   ├── fund/[cik]/page.tsx            Manager overview + filings list
│   └── fund/[cik]/[accession]/page.tsx Filing holdings + QoQ diff
├── components/
│   ├── search-input.tsx
│   └── holdings-table.tsx
└── lib/
    ├── edgar.ts          SEC EDGAR client
    ├── parse-13f.ts      Information-table XML parser
    ├── format.ts         USD/pct/date formatters
    └── utils.ts          cn helper
```

## Disclaimer

For personal research only. Not investment advice.
