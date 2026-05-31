import Link from "next/link";
import type { Metadata } from "next";
import { MARQUEE_FUNDS } from "@/lib/funds";

export const metadata: Metadata = {
  title: "About — methodology & data lineage · 13F",
  description:
    "How the 13F research platform works: data sources, backtest methodology, snapshot caveats, known gaps, and the not-investment-advice disclaimer.",
};

// Counts derived once at module load. MARQUEE_FUNDS is a static import
// from the pure-data module — no I/O — so this is free.
const FUND_COUNT = MARQUEE_FUNDS.length;
const HEAVY_FUND_COUNT = MARQUEE_FUNDS.filter(
  (f) => f.snapshotMode === "8q",
).length;
const FULL_FUND_COUNT = FUND_COUNT - HEAVY_FUND_COUNT;

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          About
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
          Methodology &amp;{" "}
          <em className="font-serif italic text-accent">data lineage</em>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          Honest answers about what this platform measures, where the data
          comes from, how the backtests are computed, and what they don&apos;t
          tell you.
        </p>
      </div>

      <Section title="What the platform tracks">
        <p>
          We curate {FUND_COUNT} institutional fund managers — a deliberately
          small set of value, activist, Tiger-lineage, multi-strat, and
          systematic shops whose 13F filings are most heavily watched as
          smart-money signal. The full list (with style tags and AUM) is on{" "}
          <Link href="/universe" className="underline decoration-hairline underline-offset-2 hover:text-foreground">
            /universe
          </Link>
          .
        </p>
        <p>
          Every quarter, each fund discloses long US equity positions on Form
          13F-HR within 45 days of quarter end. We mirror those filings,
          compute per-quarter diffs (new / increased / decreased / exited),
          and roll them into cross-fund consensus, entry/exit feeds, and
          backtested portfolios.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>13F filings &amp; fund metadata:</strong> SEC EDGAR
            directly (no third-party aggregator). Filings are fetched on
            demand and cached server-side; snapshotted funds are persisted
            into <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[11px] text-foreground/80">src/data/backtest/&lt;cik&gt;.json</code>
            {" "}so the dashboard renders instantly.
          </li>
          <li>
            <strong>Fundamentals:</strong> SEC XBRL{" "}
            <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[11px] text-foreground/80">companyconcept</code> API — the same source
            EDGAR uses for its own financial summaries.
          </li>
          <li>
            <strong>Prices:</strong> Yahoo Finance for daily close prices and
            sparkline series.
          </li>
          <li>
            <strong>CUSIP → ticker mapping:</strong> a seed file built from
            OpenFIGI, supplemented by a manual fixups list for the most
            heavily-held names where the OpenFIGI mapping is ambiguous or
            stale. Coverage is good for large-cap US equities; thinner for
            ADRs, REITs, and recent IPOs.
          </li>
        </ul>
      </Section>

      <Section title="Backtest methodology">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Fills</strong> are at the <em>filing-date close</em> — the
            day the 13F became public, NOT the as-of date (quarter end). This
            is conservative: a real follower can&apos;t trade until the data
            is filed, often 45 days after the fund actually bought.
          </li>
          <li>
            <strong>T+45 reality.</strong> A position labeled
            &ldquo;new this quarter&rdquo; was opened sometime in the
            three-month as-of window and disclosed up to 45 days after
            quarter end. Treat all timestamps as &ldquo;disclosed&rdquo;
            timestamps, not real-time.
          </li>
          <li>
            <strong>No slippage</strong> by default. Backtests are stylized —
            no transaction costs, no market impact, no borrow costs for
            shorts. A real implementation will lag.
          </li>
          <li>
            <strong>Survivorship.</strong> Snapshots only include funds that
            are <em>currently</em> on our marquee list. Funds we&apos;ve since
            dropped, or that wound down, are not present in the historical
            cohort — backtests overstate the universe&apos;s skill against a
            true any-fund-of-its-era control.
          </li>
          <li>
            See{" "}
            <Link href="/backtest/follower" className="underline decoration-hairline underline-offset-2 hover:text-foreground">
              /backtest/follower
            </Link>{" "}
            and{" "}
            <Link href="/backtest/conviction" className="underline decoration-hairline underline-offset-2 hover:text-foreground">
              /backtest/conviction
            </Link>{" "}
            for the strategies these snapshots feed.
          </li>
        </ul>
      </Section>

      <Section title="Snapshot mode caveats">
        <p>
          {FULL_FUND_COUNT} of {FUND_COUNT} funds are snapshotted across their
          full available 13F history (back to ~2013 in most cases). The
          remaining {HEAVY_FUND_COUNT} are &ldquo;8Q&rdquo; funds — too large
          and high-turnover (Citadel, Millennium, D.E. Shaw, etc.) to be
          backtested across decades without prohibitive snapshot cost; their
          window is the most recent eight quarters.
        </p>
        <p>
          Practical impact: aggregate stats across &ldquo;all funds&rdquo;
          blend two cohorts of different historical depth. The 52Q-cohort
          numbers are comparable to each other; the 8Q-cohort numbers are
          NOT comparable to the 52Q ones outside the most recent eight
          quarters. The fund pages annotate which mode they&apos;re in.
        </p>
      </Section>

      <Section title="Known gaps">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Trian:</strong> the 13F parser doesn&apos;t yet handle
            their atypical filing structure cleanly. Trian shows on{" "}
            <Link href="/universe" className="underline decoration-hairline underline-offset-2 hover:text-foreground">
              /universe
            </Link>{" "}
            for completeness but its snapshot is not included in
            cross-fund consensus or backtests.
          </li>
          <li>
            <strong>Starboard:</strong> CUSIP→ticker coverage on Starboard&apos;s
            portfolio is incomplete (several mid-cap activist targets aren&apos;t
            in the OpenFIGI seed). Tickerless rows still appear with the CUSIP.
          </li>
          <li>
            <strong>Short positions, options exposure, swaps:</strong> not
            disclosed on Form 13F. A fund &ldquo;exiting&rdquo; on 13F may have
            replaced the position with options or swaps that aren&apos;t
            disclosed at all. Treat 13F as a partial view of the long book.
          </li>
        </ul>
      </Section>

      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Not investment advice
        </div>
        <p>
          Everything on this site is built for personal research and
          curiosity. None of it is investment advice, recommendation, or
          solicitation. 13F is a quarterly disclosure filed up to 45 days
          after the quarter ends — by the time you see a position here, the
          fund may have already added to, trimmed, or exited it. Do your own
          work.
        </p>
      </section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}
