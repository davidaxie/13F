import Link from "next/link";
import { notFound } from "next/navigation";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { PnlStairstepChart } from "@/components/charts/pnl-stairstep";
import { TradeScatterChart } from "@/components/charts/trade-scatter";
import { getFundInfo } from "@/lib/edgar";
import { runBacktest, type BacktestTrade } from "@/lib/backtest";
import { getSnapshot } from "@/lib/snapshots";
import { formatDate, formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ cik: string }>;
}) {
  const { cik } = await params;

  // Prefer the bundled snapshot — instant + always works on Vercel.
  // Fall back to a live backtest for non-marquee funds (or for cases
  // where the snapshot didn't ship for some reason).
  const snapshot = getSnapshot(cik);

  let info;
  try {
    info = await getFundInfo(cik, "recent");
  } catch {
    notFound();
  }
  if (!info.name) notFound();

  const result =
    snapshot ?? (await runBacktest(info.cik, info.name, 10000, "all"));

  const {
    trades,
    equityCurve,
    pnlSeries,
    stats,
    filingCount,
    mappedCusipCount,
    unmappedCusipCount,
    startDate,
    endDate,
    startingCash,
  } = result;

  const closedTrades = trades.filter((t) => t.status === "closed");
  const openTrades = trades.filter((t) => t.status === "open");

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href={`/fund/${info.cik}`}
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← {info.name}
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Backtest
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          {info.name}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          What you&apos;d have made by mirroring {info.name}&apos;s public 13F
          filings, starting with ${startingCash.toLocaleString()} on{" "}
          {formatDate(startDate)} and rebalancing at every disclosure through{" "}
          {formatDate(endDate)}.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <span>{filingCount} filings replayed</span>
          <span>
            {mappedCusipCount} of {mappedCusipCount + unmappedCusipCount} CUSIPs
            mapped to tickers
          </span>
          <span>{closedTrades.length} closed trades</span>
          <span>{openTrades.length} still open</span>
        </div>
      </div>

      {/* ============ A. Equity curve ============ */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Equity curve
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            ${startingCash.toLocaleString()} mirrored · vs SPY
          </span>
        </div>

        <div className="mt-6">
          <EquityCurveChart data={equityCurve} startingCash={startingCash} />
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-xs text-muted">
          <Legend
            label="Mirror portfolio"
            swatch={
              <span className="inline-block h-[2px] w-6 align-middle bg-foreground" />
            }
          />
          <Legend
            label="$10k in SPY"
            swatch={
              <span
                className="inline-block h-[2px] w-6 align-middle"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, var(--muted) 50%, transparent 50%)",
                  backgroundSize: "6px 2px",
                }}
              />
            }
          />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Mirror — final"
            value={formatUSD(stats.mirrorFinal, { compact: true })}
            tone={stats.mirrorReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="SPY — final"
            value={formatUSD(stats.spyFinal, { compact: true })}
          />
          <Stat
            label="Mirror return"
            value={`${stats.mirrorReturnPct >= 0 ? "+" : ""}${formatPct(stats.mirrorReturnPct, 1)}`}
            tone={stats.mirrorReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Alpha vs SPY"
            value={`${stats.alphaPct >= 0 ? "+" : ""}${formatPct(stats.alphaPct, 1)}`}
            tone={stats.alphaPct >= 0 ? "up" : "down"}
          />
        </div>
      </section>

      {/* ============ B. P&L stair-step ============ */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Realized P&amp;L · closed trades
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            Cumulative profit from positions opened and later sold
          </span>
        </div>

        <div className="mt-6">
          <PnlStairstepChart data={pnlSeries} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Realized P&L"
            value={`${stats.realizedPnlUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(stats.realizedPnlUsd), { compact: true })}`}
            tone={stats.realizedPnlUsd >= 0 ? "up" : "down"}
          />
          <Stat label="Closed trades" value={stats.closedTrades.toLocaleString()} />
          <Stat
            label="Win rate"
            value={`${(stats.winRate * 100).toFixed(0)}%`}
          />
          <Stat
            label="Avg return / closed"
            value={`${stats.avgReturnPct >= 0 ? "+" : ""}${formatPct(stats.avgReturnPct, 1)}`}
            tone={stats.avgReturnPct >= 0 ? "up" : "down"}
          />
        </div>

        {pnlSeries.length > 0 && (
          <div className="mt-10">
            <h3 className="font-serif text-lg text-foreground">
              Biggest closed trades
            </h3>
            <BiggestTradesTable trades={closedTrades} />
          </div>
        )}
      </section>

      {/* ============ C. Trade scatter ============ */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Every trade · entry date × return
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            Bubble = position size at entry
          </span>
        </div>

        <div className="mt-6">
          <TradeScatterChart trades={trades} />
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-xs text-muted">
          <Legend
            label="Positive"
            swatch={
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "var(--positive)" }}
              />
            }
          />
          <Legend
            label="Negative"
            swatch={
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: "var(--negative)" }}
              />
            }
          />
          <Legend
            label="Still open (marked to market)"
            swatch={
              <span
                className="inline-block h-3 w-3 rounded-full border border-dashed border-current"
                style={{ borderColor: "var(--muted)" }}
              />
            }
          />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Best closed pick"
            value={
              stats.bestTrade
                ? `${stats.bestTrade.ticker ?? stats.bestTrade.issuer.split(" ")[0]} +${stats.bestTrade.returnPct.toFixed(0)}%`
                : "—"
            }
            tone="up"
          />
          <Stat
            label="Worst closed pick"
            value={
              stats.worstTrade
                ? `${stats.worstTrade.ticker ?? stats.worstTrade.issuer.split(" ")[0]} ${stats.worstTrade.returnPct.toFixed(0)}%`
                : "—"
            }
            tone="down"
          />
          <Stat label="Total trades" value={trades.length.toLocaleString()} />
          <Stat label="Open trades" value={openTrades.length.toLocaleString()} />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div
        className={cn(
          "mt-2 font-serif text-3xl tabular text-foreground",
          tone === "up" && "text-positive",
          tone === "down" && "text-negative",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Legend({
  label,
  swatch,
}: {
  label: string;
  swatch: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      {swatch}
      <span>{label}</span>
    </span>
  );
}

function BiggestTradesTable({ trades }: { trades: BacktestTrade[] }) {
  const top = [...trades]
    .sort((a, b) => Math.abs(b.pnlUsd) - Math.abs(a.pnlUsd))
    .slice(0, 10);
  if (top.length === 0) {
    return <p className="mt-4 text-sm text-muted">No closed trades.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
            <th className="py-3 pr-3 font-normal">Issuer</th>
            <th className="py-3 px-3 font-normal">Entry</th>
            <th className="py-3 px-3 font-normal">Exit</th>
            <th className="py-3 px-3 text-right font-normal">Held</th>
            <th className="py-3 px-3 text-right font-normal">Return</th>
            <th className="py-3 pl-3 text-right font-normal">P&L</th>
          </tr>
        </thead>
        <tbody>
          {top.map((t, i) => {
            const entryT = new Date(t.entryDate).getTime();
            const exitT = t.exitDate ? new Date(t.exitDate).getTime() : Date.now();
            const heldQuarters = Math.max(
              1,
              Math.round((exitT - entryT) / (90 * 86400000)),
            );
            const positive = t.returnPct >= 0;
            return (
              <tr
                key={`${t.cusip}-${i}`}
                className="border-b border-hairline/60"
              >
                <td className="py-3 pr-3 text-foreground">
                  <div className="font-serif text-base leading-tight">
                    {t.issuer}
                  </div>
                  <div className="font-mono text-xs text-muted">
                    {t.ticker ?? t.cusip}
                  </div>
                </td>
                <td className="py-3 px-3 text-muted tabular">
                  {quarterLabel(t.entryDate)}
                </td>
                <td className="py-3 px-3 text-muted tabular">
                  {t.exitDate ? quarterLabel(t.exitDate) : "—"}
                </td>
                <td className="py-3 px-3 text-right text-muted tabular">
                  {heldQuarters}Q
                </td>
                <td
                  className={cn(
                    "py-3 px-3 text-right tabular",
                    positive ? "text-positive" : "text-negative",
                  )}
                >
                  {positive ? "+" : ""}
                  {t.returnPct.toFixed(0)}%
                </td>
                <td
                  className={cn(
                    "py-3 pl-3 text-right tabular",
                    t.pnlUsd >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {t.pnlUsd >= 0 ? "+" : "−"}
                  {formatUSD(Math.abs(t.pnlUsd), { compact: true })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
