import Link from "next/link";
import { computeConvictionBacktest } from "@/lib/conviction-backtest";
import { ConvictionView } from "@/components/conviction-view";

export default function ConvictionPage() {
  const data = computeConvictionBacktest();
  // Baseline (min 1 quarter = no filter)
  const baseline = data.buckets[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/backtest/follower"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Follower
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Backtest · Conviction
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          Buy their ideas. Hold yours.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Different from the quarter-to-quarter follower: here you buy
          $10k at every fund disclosure but <strong>hold to today</strong>{" "}
          (regardless of whether the fund still owns it). Then filter to
          signals where the fund itself held the position for at least N
          quarters — using their duration as a conviction signal.
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted/80">
          {baseline.stats.totalSignals.toLocaleString()} total signals
          across {baseline.perFund.length} marquee funds. Move the slider
          below to tighten the conviction filter.
        </p>
      </div>

      <ConvictionView data={data} />

      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Caveats
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Conviction = (last appearance − first appearance) in the
            fund&apos;s 13Fs, in quarters. A fund that opened a position in
            Q1 2020 and exited Q1 2022 counts as 8 quarters of hold.
          </li>
          <li>
            All buys priced at filing date (45-day disclosure lag baked in).
            All exits priced at today&apos;s adjusted close from Yahoo.
          </li>
          <li>
            Open positions and closed positions are both marked-to-market
            at today. The fund&apos;s actual exit price is ignored — you
            chose to hold longer.
          </li>
          <li>
            Heavy funds (Renaissance, Citadel, Two Sigma, Soros) use
            8-quarter snapshots, so a ≥8Q conviction filter will mostly
            exclude them. Funds with full history (Berkshire, Pershing,
            Tiger, Bridgewater, Appaloosa) dominate the high-conviction
            buckets.
          </li>
          <li>
            Each &ldquo;buy signal&rdquo; is a separate $10k lot —
            so a position the fund added to 8 times generates 8 lots,
            each with its own entry price.
          </li>
        </ul>
      </section>
    </div>
  );
}
