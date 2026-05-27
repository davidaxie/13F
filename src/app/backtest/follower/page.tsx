import Link from "next/link";
import {
  computeFollowerBacktest,
  type EnrichedSignal,
  type FollowerBacktest,
} from "@/lib/follower-backtest";
import { FollowerView } from "@/components/follower-view";

// Static — backtest is computed once at build time. The slider mutates only
// client-side state; it scales pre-computed dollar amounts by k.
export default function FollowerBacktestPage() {
  const result = computeFollowerBacktest();

  // Only ship what the client needs:
  //   - stats (aggregate)
  //   - perFund summary (small)
  //   - realizedSeries (one point per closed-trade exit date — ~hundreds of points)
  //   - top 10 winners + top 10 losers by alpha
  // We do NOT ship the full 61k EnrichedSignal[] — that would be ~30MB payload.
  const base: FollowerBacktest = {
    positionSizeUsd: result.positionSizeUsd,
    signals: [], // intentionally empty for the client; not needed
    costVariants: result.costVariants,
    stats: result.stats,
    perFund: result.perFund,
    realizedSeries: result.realizedSeries,
  };
  const topGainers: EnrichedSignal[] = [...result.signals]
    .filter((s) => s.status === "closed")
    .sort((a, b) => b.alphaUsd - a.alphaUsd)
    .slice(0, 10);
  const topLosers: EnrichedSignal[] = [...result.signals]
    .filter((s) => s.status === "closed")
    .sort((a, b) => a.alphaUsd - b.alphaUsd)
    .slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Backtest
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          The disclosure follower
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Buy a fixed dollar amount of every position each marquee fund
          discloses (new opens and adds), at the filing-date price. Sell the
          moment the fund&apos;s next filing no longer shows it. Drag the
          slider to size each signal differently and see how the dollar
          figures rescale.
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted/80">
          {result.stats.totalSignals.toLocaleString()} buy signals across{" "}
          {result.perFund.length} funds ·{" "}
          {result.stats.closedSignals.toLocaleString()} closed ·{" "}
          {result.stats.openSignals.toLocaleString()} marked-to-market · avg
          hold {Math.round(result.stats.avgHoldDays)} days
        </p>
      </div>

      <FollowerView base={base} topGainers={topGainers} topLosers={topLosers} />

      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Caveats
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Survivorship bias.</strong> The nine marquee funds are
            well-known and still operating; this sample excludes funds that
            blew up. Aggregate alpha is biased upward versus a non-curated
            universe; comparisons within the sample are still informative.
          </li>
          <li>
            Filing-date pricing is the theoretical earliest moment a follower
            could have acted. Real-world execution is T+1 to T+5; the
            disclosure-day alpha decays fast. (T+N sensitivity table is on
            the roadmap.)
          </li>
          <li>
            Heavy funds (Renaissance, Bridgewater, Citadel, Two Sigma) use
            8-quarter snapshots; the rest use full history. The aggregate
            return reflects this uneven sampling.
          </li>
          <li>
            All buys priced at the 13F filing date (45 days after period-end —
            the earliest a follower could act). Exits priced at the next
            filing&apos;s date.
          </li>
          <li>
            Prices are <strong>Yahoo&apos;s adjusted close</strong> — adjusted
            for both splits and dividends — so total return (price
            appreciation + reinvested dividends) is captured. SPY&apos;s
            ~2%/yr dividends are properly counted in the benchmark.
          </li>
          <li>
            No transaction costs, taxes, or slippage modeled. Yahoo&apos;s
            adjusted-close has minor quirks for very old (10+ yr) historical
            data; per-signal returns within a typical hold window are
            accurate but year-over-decade returns can have ±5–10% noise.
          </li>
          <li>
            Open positions are marked-to-market at the most recent close.
            Their sell-side P&amp;L is unrealized.
          </li>
          <li>
            Signals with unmapped tickers (small/foreign/delisted) are
            excluded. Options and short positions are excluded throughout.
          </li>
        </ul>
      </section>
    </div>
  );
}
