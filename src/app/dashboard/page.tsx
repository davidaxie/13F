import Link from "next/link";
import { Suspense } from "react";
import { ConsensusHighlights } from "@/components/consensus-highlights";
import { CrossFundHighlights } from "@/components/cross-fund-highlights";
import {
  FundCardSkeleton,
  HighlightsSkeleton,
} from "@/components/dashboard-skeletons";
import { FundCard } from "@/components/fund-card";
import { computeConsensusView } from "@/lib/consensus";
import { MARQUEE_FUNDS } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function DashboardPage() {
  // Consensus data is snapshot-backed and synchronous on the server — compute
  // it here and pass into the (client) ConsensusHighlights so the toggle for
  // hiding systematic rows can live in state without round-tripping.
  const consensus = computeConsensusView();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Cross-fund signal
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          Where the smart money converges
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          The names multiple top funds are opening, or fully unwinding, in the
          same quarter. The highest-conviction cross-fund signal, front and
          center.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/consensus"
            className="inline-flex items-center gap-2 border-b border-accent/30 pb-0.5 text-sm text-accent transition-colors hover:border-accent"
          >
            Full consensus &amp; crowding →
          </Link>
          <Link
            href="/entries"
            className="inline-flex items-center gap-2 border-b border-accent/30 pb-0.5 text-sm text-accent transition-colors hover:border-accent"
          >
            Entries by style →
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 border-b border-accent/30 pb-0.5 text-sm text-accent transition-colors hover:border-accent"
          >
            Backtest leaderboard →
          </Link>
        </div>
      </div>

      {/* CORE FEATURE — consensus entries & exits (snapshot-backed, instant). */}
      <div className="mt-14">
        <ConsensusHighlights
          topBuys={consensus.topBuys}
          topExits={consensus.topExits}
        />
      </div>

      {/* Secondary — every individual move (live SEC fetch, hence Suspense). */}
      <div className="mt-24 border-b border-hairline pb-3">
        <h2 className="font-serif text-2xl text-foreground">
          All moves <span className="text-muted">· every fund, every change</span>
        </h2>
      </div>
      <div className="mt-8">
        <Suspense fallback={<HighlightsSkeleton />}>
          <CrossFundHighlights />
        </Suspense>
      </div>

      <div className="mt-20 border-b border-hairline pb-3">
        <h2 className="font-serif text-2xl text-foreground">By fund</h2>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-2">
        {MARQUEE_FUNDS.map((f) => (
          <Suspense
            key={f.cik}
            fallback={<FundCardSkeleton name={f.displayName} />}
          >
            <FundCard cik={f.cik} displayName={f.displayName} />
          </Suspense>
        ))}
      </div>
    </div>
  );
}
