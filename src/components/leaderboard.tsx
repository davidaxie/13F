import Link from "next/link";
import { MARQUEE_FUNDS, type MarqueeFund } from "@/lib/dashboard";
import { getSnapshot } from "@/lib/snapshots";
import { Sparkline } from "@/components/charts/sparkline";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

type Snap = NonNullable<ReturnType<typeof getSnapshot>>;
type Row = { fund: MarqueeFund; bt: Snap; years: number; cagrPct: number };

// CAGR from total return + horizon in years. Negative-return CAGR is undefined
// in pure form (fractional roots of negatives), so we return -100 when the
// portfolio is wiped; otherwise apply the standard (1 + r)^(1/n) - 1.
function computeCagrPct(totalReturnPct: number, years: number): number {
  if (!Number.isFinite(totalReturnPct) || years <= 0) return 0;
  const growth = 1 + totalReturnPct / 100;
  if (growth <= 0) return -100;
  return (Math.pow(growth, 1 / years) - 1) * 100;
}

function yearsBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso + "T00:00:00Z").getTime();
  const b = new Date(endIso + "T00:00:00Z").getTime();
  return Math.max(0, (b - a) / (365.25 * 86400 * 1000));
}

export function Leaderboard() {
  // Read pre-computed snapshots; render synchronously. No SEC/OpenFIGI/
  // Yahoo calls happen at request time — the whole leaderboard ships as
  // static data inlined into the server bundle.
  const allRows: Row[] = MARQUEE_FUNDS.map((f) => {
    const bt = getSnapshot(f.cik);
    if (!bt) return null;
    const years = yearsBetween(bt.startDate, bt.endDate);
    return {
      fund: f,
      bt,
      years,
      cagrPct: computeCagrPct(bt.stats.mirrorReturnPct, years),
    } satisfies Row;
  }).filter((r): r is Row => r !== null);

  // Partition by snapshot window. Heavy quant funds use an 8Q window and are
  // not comparable to full-history funds on raw total return — rank them
  // separately so a 24-year Tiger doesn't sit above a 2-year D.E. Shaw on
  // the same totals.
  const recentRows = allRows
    .filter((r) => r.fund.snapshotMode === "8q")
    .sort((a, b) => b.bt.stats.mirrorReturnPct - a.bt.stats.mirrorReturnPct);
  const fullRows = allRows
    .filter((r) => r.fund.snapshotMode !== "8q")
    .sort((a, b) => b.bt.stats.mirrorReturnPct - a.bt.stats.mirrorReturnPct);

  return (
    <div className="space-y-16">
      <RankTable
        title="Full history"
        subtitle={`${fullRows.length} funds · since first 13F`}
        rows={fullRows}
      />
      <RankTable
        title="Recent (8Q snapshot)"
        subtitle={`${recentRows.length} funds · last 8 quarters`}
        rows={recentRows}
      />

      <p className="text-xs leading-relaxed text-muted">
        Pre-computed snapshots — re-run locally and redeploy to refresh.
        Heavy quant books (Renaissance, Citadel, Two Sigma, Soros, D.E. Shaw,
        AQR, Millennium, Point72) use the last 8 quarters; the rest use full
        history. CAGR annualizes the total return over the snapshot window.
      </p>
    </div>
  );
}

function RankTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
}) {
  if (rows.length === 0) {
    return (
      <div>
        <div className="border-b border-hairline pb-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">{title}</h2>
            <span className="text-xs uppercase tracking-widest text-muted">
              {subtitle}
            </span>
          </div>
        </div>
        <p className="mt-6 text-sm text-muted">No funds in this cohort.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-hairline pb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">{title}</h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            {subtitle} · $10k mirrored vs SPY
          </span>
        </div>
      </div>

      <ul className="mt-2">
        {rows.map(({ fund, bt, cagrPct }, i) => {
          const positive = bt.stats.mirrorReturnPct >= bt.stats.spyReturnPct;
          return (
            <li key={fund.cik} className="border-b border-hairline/60">
              <Link
                href={`/fund/${fund.cik}/performance`}
                className="group grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4 py-4 transition-colors hover:bg-subtle/40 sm:grid-cols-[28px_minmax(0,1.3fr)_200px_minmax(0,1fr)]"
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
                    width={200}
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
                    CAGR{" "}
                    <span
                      className={cn(
                        cagrPct >= 0 ? "text-positive" : "text-negative",
                      )}
                    >
                      {cagrPct >= 0 ? "+" : ""}
                      {formatPct(cagrPct, 1)}
                    </span>
                    {" · "}
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
    </div>
  );
}
