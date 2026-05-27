import type { EquityCurvePoint } from "./backtest";
import benchData from "./benchmark-prices.json";

type Bar = { t: number; c: number };

export const BENCHMARK_KEYS = ["SPY", "IWM", "QQQ", "EFA", "AGG"] as const;
export type BenchmarkKey = (typeof BENCHMARK_KEYS)[number];

export type BenchmarkMeta = {
  ticker: string;
  label: string;
  description: string;
};

export const BENCHMARKS: Record<BenchmarkKey, BenchmarkMeta> = {
  SPY: { ticker: "SPY", label: "S&P 500", description: "US large-cap broad market" },
  IWM: { ticker: "IWM", label: "Russell 2000", description: "US small-cap" },
  QQQ: { ticker: "QQQ", label: "Nasdaq-100", description: "US large-cap tech-heavy" },
  EFA: { ticker: "EFA", label: "MSCI EAFE", description: "Developed ex-US" },
  AGG: { ticker: "AGG", label: "US Aggregate Bond", description: "Investment-grade bonds" },
};

const DATA = benchData as Record<BenchmarkKey, { bars: Bar[]; ticker: string; label: string }>;

export function isBenchmark(s: string | null | undefined): s is BenchmarkKey {
  return typeof s === "string" && (s as BenchmarkKey) in BENCHMARKS;
}

function priceOnOrBefore(bars: Bar[], unix: number): number | null {
  if (bars.length === 0) return null;
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t <= unix) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? bars[ans].c : null;
}

/**
 * Re-key the `spy` field on every point of an equity curve to the chosen
 * benchmark's value. The mirror side is untouched. Downstream code (the
 * chart, the risk-metrics computation, alpha/beta math) all read from the
 * `spy` field, so swapping its meaning here is enough to switch benchmarks
 * everywhere with no other code changes.
 *
 * If the benchmark doesn't have data covering the curve's start, falls back
 * to leaving the SPY values in place so we never render a broken chart.
 */
export function rekeyEquityCurve(
  curve: EquityCurvePoint[],
  benchmark: BenchmarkKey,
  startingCash: number,
): EquityCurvePoint[] {
  if (benchmark === "SPY") return curve;
  if (curve.length === 0) return curve;
  const bars = DATA[benchmark]?.bars;
  if (!bars || bars.length === 0) return curve;

  const startUnix = Math.floor(
    new Date(curve[0].date + "T00:00:00Z").getTime() / 1000,
  );
  const startPrice = priceOnOrBefore(bars, startUnix);
  if (startPrice == null || startPrice <= 0) return curve;

  const shares = startingCash / startPrice;

  return curve.map((p) => {
    const unix = Math.floor(new Date(p.date + "T00:00:00Z").getTime() / 1000);
    const price = priceOnOrBefore(bars, unix);
    return {
      ...p,
      spy: price != null ? shares * price : startingCash,
    };
  });
}
