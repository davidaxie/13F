import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { MARQUEE_FUNDS } from "@/lib/funds";

// First 8 funds from the marquee list. This rotates implicitly as we add
// snapshots (MARQUEE_FUNDS is ordered by inclusion date / prominence in
// src/lib/funds.ts) instead of being a static hand-picked list that goes
// stale. Slicing here keeps the home page light — no full universe load.
const FUND_SUGGESTIONS = MARQUEE_FUNDS.slice(0, 8).map((f) => ({
  label: f.displayName,
  // Use the fund's CIK directly — tracked funds resolve to their performance
  // page so the click lands on the rich backtest view, not the holdings list.
  href: `/fund/${f.cik}/performance`,
}));

// Curated top-8 — the actual most-traded names across the marquee universe.
// Hand-picked vs derived because computeConsensusView is a heavier server
// call we don't want gating the home page.
const STOCK_SUGGESTIONS = [
  { label: "AAPL", t: "AAPL" },
  { label: "NVDA", t: "NVDA" },
  { label: "GOOGL", t: "GOOGL" },
  { label: "MSFT", t: "MSFT" },
  { label: "META", t: "META" },
  { label: "AMZN", t: "AMZN" },
  { label: "BRK-B", t: "BRK-B" },
  { label: "JPM", t: "JPM" },
];

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-2xl py-24">
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
          Holdings research,
          <br />
          <em className="font-serif italic text-accent">beautifully.</em>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
          Cross-fund consensus from {MARQUEE_FUNDS.length}{" "}of the
          world&apos;s most-watched institutional 13F filers. Quarter over
          quarter, sourced directly from SEC EDGAR.
        </p>

        <div className="mt-12">
          <SearchInput size="lg" autoFocus />
        </div>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span className="text-xs uppercase tracking-widest text-muted/70">
            Try
          </span>
          {FUND_SUGGESTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="transition-colors hover:text-foreground"
            >
              {s.label}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span className="text-xs uppercase tracking-widest text-muted/70">
            or a stock
          </span>
          {STOCK_SUGGESTIONS.map((s) => (
            <Link
              key={s.t}
              href={`/stock/${s.t}`}
              className="font-mono transition-colors hover:text-foreground"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
