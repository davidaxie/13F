import Link from "next/link";
import { Suspense } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { LeaderboardSkeleton } from "@/components/dashboard-skeletons";

export const dynamic = "force-dynamic";
// Hobby: 60s max. Pro: 300s. Cold-start a 9-fund backtest comfortably needs
// the longer ceiling, but we keep this set so it picks up the higher limit
// automatically on Pro.
export const maxDuration = 300;

export default function LeaderboardPage() {
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
          Leaderboard
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          $10k mirrored to each fund&apos;s reported 13F holdings across every
          quarter SEC has on file. Daily-marked, rebalanced at every filing,
          ranked vs SPY.
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted/80">
          First load fetches CUSIP→ticker mappings via OpenFIGI and daily prices
          via Yahoo Finance — expect a wait on a cold cache. Subsequent loads
          within the same container are instant.
        </p>
      </div>

      <div className="mt-12">
        <Suspense fallback={<LeaderboardSkeleton />}>
          <Leaderboard />
        </Suspense>
      </div>
    </div>
  );
}
