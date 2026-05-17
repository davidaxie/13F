import Link from "next/link";
import { Suspense } from "react";
import { MARQUEE_FUNDS } from "@/lib/dashboard";
import { runBacktest, type FundBacktest } from "@/lib/backtest";
import { Sparkline } from "@/components/charts/sparkline";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

async function safeBacktest(
  cik: string,
  name: string,
): Promise<FundBacktest | null> {
  try {
    return await runBacktest(cik, name, 10000, "all");
  } catch (err) {
    console.warn(`leaderboard: backtest failed for ${name}: ${err}`);
    return null;
  }
}

export function Leaderboard() {
  return (
    <div>
      <div className="border-b border-hairline pb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">Leaderboard</h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            $10k mirrored · vs SPY
          </span>
        </div>
      </div>

      <ul className="mt-2">
        {MARQUEE_FUNDS.map((f, i) => (
          <li key={f.cik} className="border-b border-hairline/60">
            <Suspense fallback={<RowSkeleton fund={f} rank={i + 1} />}>
              <Row fund={f} fallbackRank={i + 1} />
            </Suspense>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Each row streams in as its backtest completes. Rows are listed in the
        marquee order; absolute return is shown next to each fund. On a cold
        cache, slower funds may not finish within the function timeout — they
        appear as &ldquo;Computing…&rdquo; until you reload.
      </p>
    </div>
  );
}

function RowSkeleton({
  fund,
  rank,
}: {
  fund: (typeof MARQUEE_FUNDS)[number];
  rank: number;
}) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1.4fr)_240px_minmax(0,1fr)] items-center gap-4 py-4">
      <span className="font-mono text-xs text-muted">
        {String(rank).padStart(2, "0")}
      </span>
      <div>
        <div className="font-serif text-xl text-muted">{fund.displayName}</div>
        <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted/60">
          Computing…
        </div>
      </div>
      <div className="h-9 rounded bg-hairline/40 animate-pulse" />
      <div className="text-right">
        <div className="ml-auto h-4 w-20 rounded bg-hairline/60 animate-pulse" />
      </div>
    </div>
  );
}

async function Row({
  fund,
  fallbackRank,
}: {
  fund: (typeof MARQUEE_FUNDS)[number];
  fallbackRank: number;
}) {
  const bt = await safeBacktest(fund.cik, fund.displayName);

  if (!bt) {
    return (
      <div className="grid grid-cols-[28px_minmax(0,1.4fr)_240px_minmax(0,1fr)] items-center gap-4 py-4 opacity-60">
        <span className="font-mono text-xs text-muted">
          {String(fallbackRank).padStart(2, "0")}
        </span>
        <div>
          <div className="font-serif text-xl text-foreground">
            {fund.displayName}
          </div>
          <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
            No data available
          </div>
        </div>
        <div />
        <div />
      </div>
    );
  }

  const positive = bt.stats.mirrorReturnPct >= bt.stats.spyReturnPct;
  return (
    <Link
      href={`/fund/${fund.cik}/performance`}
      className="group grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-4 py-4 transition-colors hover:bg-subtle/40 sm:grid-cols-[28px_minmax(0,1.4fr)_240px_minmax(0,1fr)]"
    >
      <span className="font-mono text-xs text-muted">
        {String(fallbackRank).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <div className="truncate font-serif text-xl text-foreground transition-colors group-hover:text-accent">
          {fund.displayName}
        </div>
        <div className="mt-0.5 truncate font-mono text-xs uppercase tracking-wider text-muted">
          {bt.filingCount} filings · {bt.trades.length} trades · {bt.startDate.slice(0, 4)}—
          {bt.endDate.slice(0, 4)}
        </div>
      </div>

      <div className="hidden sm:block">
        <Sparkline
          data={bt.equityCurve.map((p) => ({ v: p.mirror }))}
          width={240}
          height={36}
          stroke={positive ? "var(--positive)" : "var(--negative)"}
        />
      </div>

      <div className="text-right">
        <div
          className={cn(
            "tabular text-base",
            bt.stats.mirrorReturnPct >= 0 ? "text-positive" : "text-negative",
          )}
        >
          {bt.stats.mirrorReturnPct >= 0 ? "+" : ""}
          {formatPct(bt.stats.mirrorReturnPct, 0)}
        </div>
        <div className="mt-0.5 text-xs text-muted tabular">
          SPY {bt.stats.spyReturnPct >= 0 ? "+" : ""}
          {formatPct(bt.stats.spyReturnPct, 0)}
          {" · "}
          <span
            className={
              bt.stats.alphaPct >= 0 ? "text-positive" : "text-negative"
            }
          >
            α {bt.stats.alphaPct >= 0 ? "+" : ""}
            {formatPct(bt.stats.alphaPct, 0)}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted tabular">
          {formatUSD(bt.stats.mirrorFinal, { compact: true })} from $10k
        </div>
      </div>
    </Link>
  );
}
