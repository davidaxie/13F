import Link from "next/link";
import { computeConvictionBacktest } from "@/lib/conviction-backtest";
import { MARQUEE_FUNDS } from "@/lib/funds";
import { CaveatCallout } from "@/components/caveat-callout";
import { ConvictionView } from "@/components/conviction-view";

// Derived once from MARQUEE_FUNDS — single source of truth shared with
// /stock/[ticker] and /backtest/follower caveat blocks. Keeps the three
// caveat sites in lockstep as we tag/untag funds.
const HEAVY_FUNDS_LABEL = MARQUEE_FUNDS.filter(
  (f) => f.snapshotMode === "8q",
)
  .map((f) => f.displayName)
  .join(", ");

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

      <CaveatCallout
        items={[
          {
            title: "Survivor-biased universe",
            body: "Nine famous-name funds still operating; aggregate alpha is biased upward vs a sample including blown-up funds.",
          },
          {
            title: "Conviction = duration, not weight",
            body: "Holding period alone — a 100-share placeholder held 20Q scores the same as a 5%-weight core position.",
          },
          {
            title: "Heavy-fund window asymmetry",
            body: `${HEAVY_FUNDS_LABEL} only have 8 quarters of history; a ≥8Q filter mostly excludes them.`,
          },
        ]}
      />

      <ConvictionView data={data} />

      <section
        id="caveats"
        className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted"
      >
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Caveats
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Survivorship bias.</strong> These nine marquee funds were
            chosen because they&apos;re well-known and still operating —
            i.e. survivors. The aggregate alpha is biased upward versus a
            sample that would include funds that blew up (Archegos, Melvin,
            Bill Hwang, etc.). Treat absolute headline numbers as upper
            bounds; comparisons between funds within the sample are still
            informative.
          </li>
          <li>
            Conviction = (last appearance − first appearance) in the
            fund&apos;s 13Fs, in quarters. A fund that opened a position in
            Q1 2020 and exited Q1 2022 counts as 8 quarters of hold. This
            measures duration, not position weight — a 100-share
            placeholder held for 20 quarters scores the same as a 5%-of-
            portfolio core holding. Weight-aware ranking is on the roadmap
            (depends on reference-data layer).
          </li>
          <li>
            All buys priced at filing date (45-day disclosure lag baked in).
            Exit pricing depends on the mode selected above: &ldquo;Hold to
            today&rdquo; (default) marks every signal at the latest close;
            &ldquo;Sell when fund sold&rdquo; uses the fund&apos;s actual
            exit price (or today, for still-open positions).
          </li>
          <li>
            Heavy funds ({HEAVY_FUNDS_LABEL}) use 8-quarter snapshots, so
            a ≥8Q conviction filter will mostly exclude them. Funds with
            full history (Berkshire, Pershing, Tiger, Bridgewater,
            Appaloosa) dominate the high-conviction buckets.
          </li>
          <li>
            Each &ldquo;buy signal&rdquo; is a separate $10k lot —
            so a position the fund added to 8 times generates 8 lots,
            each with its own entry price.
          </li>
          <li>
            No transaction costs, slippage, taxes, borrow, or short-rebate
            modeled. Tax drag in particular destroys high-turnover
            strategies; treat the headline returns as gross.
          </li>
        </ul>
      </section>
    </div>
  );
}
