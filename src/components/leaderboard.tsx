import Link from "next/link";
import { MARQUEE_FUNDS } from "@/lib/dashboard";
import { getSnapshot } from "@/lib/snapshots";
import { Sparkline } from "@/components/charts/sparkline";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Leaderboard() {
  // Read pre-computed snapshots; render synchronously. No SEC/OpenFIGI/
  // Yahoo calls happen at request time — the whole leaderboard ships as
  // static data inlined into the server bundle.
  type Row = {
    fund: (typeof MARQUEE_FUNDS)[number];
    bt: NonNullable<ReturnType<typeof getSnapshot>>;
  };
  const rows: Row[] = MARQUEE_FUNDS.map((f) => {
    const bt = getSnapshot(f.cik);
    return bt ? { fund: f, bt } : null;
  })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => b.bt.stats.mirrorReturnPct - a.bt.stats.mirrorReturnPct);

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
        {rows.map(({ fund, bt }, i) => {
          const positive =
            bt.stats.mirrorReturnPct >= bt.stats.spyReturnPct;
          return (
            <li key={fund.cik} className="border-b border-hairline/60">
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
                    {bt.filingCount} filings · {bt.trades.length} trades ·{" "}
                    {bt.startDate.slice(0, 4)}—{bt.endDate.slice(0, 4)}
                  </div>
                </div>

                <div className="hidden sm:block">
                  <Sparkline
                    data={bt.equityCurve.map((p) => ({ v: p.mirror }))}
                    width={240}
                    height={36}
                    stroke={
                      positive ? "var(--positive)" : "var(--negative)"
                    }
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
                    <span
                      className={
                        bt.stats.alphaPct >= 0
                          ? "text-positive"
                          : "text-negative"
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
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Pre-computed snapshots — re-run locally and redeploy to refresh.
        Heavy funds (Renaissance, Citadel, Two Sigma) use the most recent
        8 quarters; the rest use full history.
      </p>
    </div>
  );
}
