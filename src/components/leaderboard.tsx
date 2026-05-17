import Link from "next/link";
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

export async function Leaderboard() {
  // Run all funds in parallel. The global queues inside edgar/openfigi/prices
  // serialize the actual outbound requests at safe rates, so concurrency here
  // mainly hides per-fund latency rather than amplifying load.
  const results = await Promise.all(
    MARQUEE_FUNDS.map((f) => safeBacktest(f.cik, f.displayName)),
  );

  type Row = { fund: (typeof MARQUEE_FUNDS)[number]; bt: FundBacktest };
  const rows: Row[] = results
    .map((bt, i) => (bt ? { fund: MARQUEE_FUNDS[i], bt } : null))
    .filter((x): x is Row => x !== null)
    .sort((a, b) => b.bt.stats.mirrorReturnPct - a.bt.stats.mirrorReturnPct);

  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted">
        Leaderboard data unavailable. Try refreshing — first load fetches
        ~thousands of price bars from Yahoo and can be slow on a cold cache.
      </p>
    );
  }

  return (
    <div>
      <div className="border-b border-hairline pb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">Leaderboard</h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            $10k mirrored · all available history · vs SPY
          </span>
        </div>
      </div>

      <ul className="mt-2">
        {rows.map(({ fund, bt }, i) => {
          const startISO = bt.startDate;
          const endISO = bt.endDate;
          const alpha = bt.stats.alphaPct;
          const positive = bt.stats.mirrorReturnPct >= bt.stats.spyReturnPct;
          return (
            <li
              key={fund.cik}
              className="border-b border-hairline/60"
            >
              <Link
                href={`/fund/${fund.cik}/performance`}
                className="group grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-4 py-4 transition-colors hover:bg-subtle/40 sm:grid-cols-[28px_minmax(0,1.4fr)_240px_minmax(0,1fr)]"
              >
                <span className="font-mono text-xs text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                  <div className="truncate font-serif text-xl text-foreground transition-colors group-hover:text-accent">
                    {fund.displayName}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs uppercase tracking-wider text-muted">
                    {bt.filingCount} filings · {bt.trades.length} trades · {startISO.slice(0, 4)}—{endISO.slice(0, 4)}
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
                      bt.stats.mirrorReturnPct >= 0
                        ? "text-positive"
                        : "text-negative",
                    )}
                  >
                    {bt.stats.mirrorReturnPct >= 0 ? "+" : ""}
                    {formatPct(bt.stats.mirrorReturnPct, 0)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted tabular">
                    SPY {bt.stats.spyReturnPct >= 0 ? "+" : ""}
                    {formatPct(bt.stats.spyReturnPct, 0)}
                    {" · "}
                    <span className={alpha >= 0 ? "text-positive" : "text-negative"}>
                      α {alpha >= 0 ? "+" : ""}
                      {formatPct(alpha, 0)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted tabular">
                    {formatUSD(bt.stats.mirrorFinal, { compact: true })} from $10k
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Mirroring assumes you rebalance to match the fund&apos;s reported
        holdings on each 13F filing date. Only common-stock positions with
        ticker-resolvable CUSIPs are included; options and unmapped CUSIPs are
        excluded from both the mirror portfolio and SPY benchmark.
      </p>
    </div>
  );
}
