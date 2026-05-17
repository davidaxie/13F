import { Suspense } from "react";
import { CrossFundHighlights } from "@/components/cross-fund-highlights";
import {
  FundCardSkeleton,
  HighlightsSkeleton,
  LeaderboardSkeleton,
} from "@/components/dashboard-skeletons";
import { FundCard } from "@/components/fund-card";
import { Leaderboard } from "@/components/leaderboard";
import { MARQUEE_FUNDS } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Activity
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          Latest 13F moves
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Quarter-over-quarter changes from leading institutional managers — new
          positions, full exits, and the largest adds and trims.
        </p>
      </div>

      <div className="mt-16">
        <Suspense fallback={<LeaderboardSkeleton />}>
          <Leaderboard />
        </Suspense>
      </div>

      <div className="mt-20">
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
