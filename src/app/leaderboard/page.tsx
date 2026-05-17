import Link from "next/link";
import { Leaderboard } from "@/components/leaderboard";

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
          $10k mirrored to each fund&apos;s reported 13F holdings, rebalanced
          quarter by quarter, ranked vs SPY.
        </p>
      </div>

      <div className="mt-12">
        <Leaderboard />
      </div>
    </div>
  );
}
