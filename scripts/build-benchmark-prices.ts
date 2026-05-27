// One-time / on-demand build script. Fetches daily close history for a set
// of benchmark ETFs and bundles them as a single JSON file in src/lib/. The
// resulting file is imported statically by /fund/[cik]/performance and the
// risk-metrics module, so the benchmark switcher works with no runtime
// Yahoo calls.
//
// Run: npx tsx scripts/build-benchmark-prices.ts
//
// Refresh cadence: rerun whenever you want fresher data (the latest bar
// matters for "today" marks). The script overwrites the output file in
// place; commit the result.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import YahooFinance from "yahoo-finance2";

// Mirror src/instrumentation.ts so this standalone script routes Yahoo
// through the same HTTPS_PROXY the Next.js dev server uses (required when
// running from an IP Yahoo geo-blocks, e.g. mainland China).
const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
if (proxy) {
  setGlobalDispatcher(new ProxyAgent(proxy));
  process.stderr.write(`Routing through HTTPS_PROXY=${proxy}\n`);
}

const yahoo = new YahooFinance();

// Match SPY's existing range (~2013-08-13 onward) so all four series cover
// the same window as the backtests.
const START = new Date("2013-08-13T00:00:00Z");

// Benchmarks we offer. Add to this list to expose more in the UI; no other
// code changes needed as long as the BenchmarkKey type is updated.
const BENCHMARKS = [
  { key: "SPY", ticker: "SPY", label: "S&P 500", description: "US large-cap broad market" },
  { key: "IWM", ticker: "IWM", label: "Russell 2000", description: "US small-cap" },
  { key: "QQQ", ticker: "QQQ", label: "Nasdaq-100", description: "US large-cap tech-heavy" },
  { key: "EFA", ticker: "EFA", label: "MSCI EAFE", description: "Developed ex-US" },
  { key: "AGG", ticker: "AGG", label: "US Aggregate Bond", description: "Investment-grade bonds" },
] as const;

type Bar = { t: number; c: number };

async function fetchBars(ticker: string): Promise<Bar[]> {
  const result = (await yahoo.chart(ticker, {
    period1: START,
    period2: new Date(),
    interval: "1d",
    events: "div|split",
  })) as { quotes?: Array<{ date?: Date | string; close?: number | null; adjclose?: number | null }> };
  const bars: Bar[] = [];
  for (const q of result.quotes ?? []) {
    const c = q.adjclose ?? q.close;
    if (c == null || !isFinite(c) || !q.date) continue;
    bars.push({
      t: Math.floor(new Date(q.date).getTime() / 1000),
      c,
    });
  }
  return bars;
}

async function main() {
  const out: Record<
    string,
    { ticker: string; label: string; description: string; fetchedAt: number; bars: Bar[] }
  > = {};
  for (const b of BENCHMARKS) {
    process.stderr.write(`Fetching ${b.ticker}…`);
    const bars = await fetchBars(b.ticker);
    out[b.key] = {
      ticker: b.ticker,
      label: b.label,
      description: b.description,
      fetchedAt: Date.now(),
      bars,
    };
    process.stderr.write(` ${bars.length} bars\n`);
  }
  const outPath = resolve(__dirname, "..", "src", "lib", "benchmark-prices.json");
  writeFileSync(outPath, JSON.stringify(out));
  process.stderr.write(`Wrote ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
