import Link from "next/link";
import { CaveatCallout } from "@/components/caveat-callout";
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

      <CaveatCallout
        anchor={null}
        items={[
          {
            title: "Mirror return ≠ actual fund return",
            body: "We rebalance $10k into the disclosed weights each quarter. The fund's real net return includes fees, leverage, options, shorts, and intra-quarter trades — none of which appear here.",
          },
          {
            title: "Survivor-biased universe",
            body: "These are well-known, still-operating funds. Aggregate alpha is biased upward versus a sample including blown-up managers.",
          },
          {
            title: "Two cohorts, ranked separately",
            body: "Heavy quant books (Renaissance, Citadel, Two Sigma, Soros, D.E. Shaw, AQR, Millennium, Point72) use only the last 8 quarters — not comparable on raw totals to funds with 20+ years of history.",
          },
        ]}
      />

      <div className="mt-12">
        <Leaderboard />
      </div>
    </div>
  );
}
