import Link from "next/link";
import { notFound } from "next/navigation";
import { CaveatCallout } from "@/components/caveat-callout";
import { DrawdownChart } from "@/components/charts/drawdown";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { PnlStairstepChart } from "@/components/charts/pnl-stairstep";
import { RollingAlphaChart } from "@/components/charts/rolling-alpha";
import { TradeScatterChart } from "@/components/charts/trade-scatter";
import { getFundInfo } from "@/lib/edgar";
import { runBacktest, type BacktestTrade } from "@/lib/backtest";
import {
  BENCHMARKS,
  BENCHMARK_KEYS,
  isBenchmark,
  rekeyEquityCurve,
  type BenchmarkKey,
} from "@/lib/benchmarks";
import { computeRiskMetrics, computeRollingAlpha } from "@/lib/risk-metrics";
import { getSnapshot } from "@/lib/snapshots";
import { formatDate, formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ cik: string }>;
  searchParams: Promise<{ bench?: string }>;
}) {
  const { cik } = await params;
  const { bench: rawBench } = await searchParams;
  const selectedBench: BenchmarkKey = isBenchmark(rawBench)
    ? rawBench
    : "SPY";

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
    pnlSeries,
    filingCount,
    mappedCusipCount,
    unmappedCusipCount,
    startDate,
    endDate,
    startingCash,
  } = result;

  // Re-key the curve to the user-selected benchmark. Default SPY is the
  // existing pre-baked series (no-op). All downstream math (chart, risk
  // metrics, rolling alpha, headline stats) reads the rekeyed curve so
  // alpha/beta/IR re-derive correctly per benchmark.
  const equityCurve = rekeyEquityCurve(
    result.equityCurve,
    selectedBench,
    startingCash,
  );
  // Recompute headline stats against the chosen benchmark.
  const finalPoint = equityCurve[equityCurve.length - 1] ?? {
    mirror: startingCash,
    spy: startingCash,
  };
  const stats = {
    ...result.stats,
    spyFinal: finalPoint.spy,
    spyReturnPct: ((finalPoint.spy - startingCash) / startingCash) * 100,
    alphaPct:
      ((finalPoint.mirror - finalPoint.spy) / startingCash) * 100,
  };

  const closedTrades = trades.filter((t) => t.status === "closed");
  const openTrades = trades.filter((t) => t.status === "open");

  // Risk metrics derived from the existing weekly equity curve — no snapshot
  // regeneration needed.
  const risk = computeRiskMetrics(equityCurve);
  const rollingAlpha = computeRollingAlpha(equityCurve, 52);

  // Snapshot's as-of timestamp. Threaded into BiggestTradesTable so hold
  // duration for open trades is computed against the snapshot end, not the
  // wall clock (keeps render pure).
  const asOfMs = new Date(endDate + "T00:00:00Z").getTime();

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

        <div className="mt-6 flex flex-wrap items-baseline gap-3 text-xs uppercase tracking-widest text-muted">
          <span>Benchmark</span>
          <div className="inline-flex overflow-hidden rounded border border-hairline">
            {BENCHMARK_KEYS.map((key, i) => (
              <Link
                key={key}
                href={`/fund/${info.cik}/performance?bench=${key}`}
                replace
                scroll={false}
                className={cn(
                  "px-3 py-1 transition-colors",
                  i > 0 && "border-l border-hairline",
                  selectedBench === key
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground",
                )}
                title={BENCHMARKS[key].description}
              >
                {key}
              </Link>
            ))}
          </div>
          <span className="normal-case tracking-normal text-muted/70">
            {BENCHMARKS[selectedBench].label} — {BENCHMARKS[selectedBench].description}
          </span>
        </div>
      </div>

      <CaveatCallout
        anchor={null}
        items={[
          {
            title: "13F-mirror, not the full fund",
            body: "Reflects only US long equity positions. Omits insurance float, hedges, derivatives, international/private holdings, and operating-company economics — for Berkshire, Buffett-the-investor not Berkshire-the-company.",
          },
          {
            title: "Filing-date pricing, no costs",
            body: "Mirror rebalances at each disclosure (45-day lag from period-end). No transaction costs, slippage, taxes, or borrow modeled.",
          },
          {
            title: "Mapped CUSIPs only",
            body: `${unmappedCusipCount} of ${mappedCusipCount + unmappedCusipCount} CUSIPs in this fund's history weren't resolvable to a ticker and are excluded from the mirror.`,
          },
        ]}
      />

      {/* ============ A. Equity curve ============ */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Equity curve
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            ${startingCash.toLocaleString()} mirrored · vs {selectedBench}
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
            label={`$10k in ${selectedBench}`}
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
            label={`${selectedBench} — final`}
            value={formatUSD(stats.spyFinal, { compact: true })}
          />
          <Stat
            label="Mirror return"
            value={`${stats.mirrorReturnPct >= 0 ? "+" : ""}${formatPct(stats.mirrorReturnPct, 1)}`}
            tone={stats.mirrorReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label={`Alpha vs ${selectedBench}`}
            value={`${stats.alphaPct >= 0 ? "+" : ""}${formatPct(stats.alphaPct, 1)}`}
            tone={stats.alphaPct >= 0 ? "up" : "down"}
          />
        </div>
      </section>

      {/* ============ A.5 Risk profile ============ */}
      {risk && (
        <section className="mt-20">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="font-serif text-2xl text-foreground">
              Risk profile
            </h2>
            <span className="text-xs uppercase tracking-widest text-muted">
              Weekly mirror returns vs {selectedBench} · rf ≈ 4%
            </span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4">
            <Stat
              label="Sharpe"
              value={risk.sharpe.toFixed(2)}
              tone={
                risk.sharpe >= 1 ? "up" : risk.sharpe < 0 ? "down" : undefined
              }
              title="(CAGR − rf) / annualized stddev of weekly returns. >1 is good, >2 is rare."
            />
            <Stat
              label="Max drawdown"
              value={`${risk.maxDrawdownPct.toFixed(1)}%`}
              tone="down"
              title={
                risk.maxDrawdownStart && risk.maxDrawdownTrough
                  ? `${risk.maxDrawdownStart} → ${risk.maxDrawdownTrough}${risk.maxDrawdownRecovered ? ` (recovered ${risk.maxDrawdownRecovered})` : " (not recovered)"}`
                  : "No meaningful drawdown observed"
              }
            />
            <Stat
              label={`Beta vs ${selectedBench}`}
              value={risk.betaVsSpy.toFixed(2)}
              title={`cov(mirror, ${selectedBench}) / var(${selectedBench}). 1.0 = moves like ${selectedBench}; >1 = amplified; <1 = damped.`}
            />
            <Stat
              label="Information ratio"
              value={risk.informationRatio.toFixed(2)}
              tone={
                risk.informationRatio >= 0.5
                  ? "up"
                  : risk.informationRatio < 0
                    ? "down"
                    : undefined
              }
              title={`(CAGR − ${selectedBench} CAGR) / tracking error. Skill per unit of active risk taken vs ${selectedBench}.`}
            />
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
            <Stat
              label="CAGR"
              value={`${risk.cagrPct >= 0 ? "+" : ""}${risk.cagrPct.toFixed(1)}%`}
              tone={risk.cagrPct >= risk.spyCagrPct ? "up" : "down"}
              title={`Annualized over ${risk.yearsElapsed.toFixed(1)} years · ${selectedBench} ${risk.spyCagrPct >= 0 ? "+" : ""}${risk.spyCagrPct.toFixed(1)}%`}
            />
            <Stat
              label="Volatility (ann.)"
              value={`${risk.volAnnualPct.toFixed(1)}%`}
              title={`Annualized stddev of weekly returns · ${selectedBench} ${risk.spyVolAnnualPct.toFixed(1)}%`}
            />
            <Stat
              label="Sortino"
              value={risk.sortino.toFixed(2)}
              tone={risk.sortino >= 1 ? "up" : risk.sortino < 0 ? "down" : undefined}
              title="(CAGR − rf) / downside-only annualized vol. Penalizes only losses, not upside swings."
            />
            <Stat
              label="α (Jensen, ann.)"
              value={`${risk.alphaAnnualPct >= 0 ? "+" : ""}${risk.alphaAnnualPct.toFixed(1)}%`}
              tone={risk.alphaAnnualPct >= 0 ? "up" : "down"}
              title={`CAPM alpha — CAGR − [rf + β·(${selectedBench} CAGR − rf)]. Excess return after controlling for beta.`}
            />
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
            <Stat
              label="Tracking error"
              value={`${risk.trackingErrorPct.toFixed(1)}%`}
              title={`Annualized stddev of (mirror return − ${selectedBench} return). How tightly the mirror hugs ${selectedBench}.`}
            />
            <Stat
              label="Upside capture"
              value={`${(risk.upsideCapture * 100).toFixed(0)}%`}
              tone={risk.upsideCapture >= 1 ? "up" : undefined}
              title={`Mirror's cumulative return on weeks ${selectedBench} > 0, ÷ ${selectedBench}'s cumulative on those weeks. >100% = beats ${selectedBench} when it rises.`}
            />
            <Stat
              label="Downside capture"
              value={`${(risk.downsideCapture * 100).toFixed(0)}%`}
              tone={risk.downsideCapture <= 1 ? "up" : "down"}
              title={`Mirror's cumulative return on weeks ${selectedBench} < 0, ÷ ${selectedBench}'s. <100% = falls less than ${selectedBench} in down weeks.`}
            />
            <Stat
              label="Window"
              value={`${risk.yearsElapsed.toFixed(1)}y`}
              title={`${equityCurve.length} weekly samples`}
            />
          </div>
        </section>
      )}

      {/* ============ A.7 Drawdown ============ */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Drawdown
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            Underwater curve — distance below running peak
          </span>
        </div>
        <div className="mt-6">
          <DrawdownChart data={equityCurve} />
        </div>
        {risk && risk.maxDrawdownStart && risk.maxDrawdownTrough && (
          <p className="mt-3 text-xs text-muted">
            Largest drawdown:{" "}
            <span className="tabular text-negative">
              {risk.maxDrawdownPct.toFixed(1)}%
            </span>{" "}
            from{" "}
            <span className="tabular text-foreground">
              {risk.maxDrawdownStart}
            </span>{" "}
            to{" "}
            <span className="tabular text-foreground">
              {risk.maxDrawdownTrough}
            </span>{" "}
            {risk.maxDrawdownRecovered ? (
              <>
                · recovered{" "}
                <span className="tabular text-foreground">
                  {risk.maxDrawdownRecovered}
                </span>
              </>
            ) : (
              <span className="text-negative">· not yet recovered</span>
            )}
            .
          </p>
        )}
      </section>

      {/* ============ A.8 Rolling 1y alpha ============ */}
      {rollingAlpha.length > 0 && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="font-serif text-2xl text-foreground">
              Rolling 1y alpha
            </h2>
            <span className="text-xs uppercase tracking-widest text-muted">
              Trailing 52w mirror return − {selectedBench} return
            </span>
          </div>
          <div className="mt-6">
            <RollingAlphaChart data={rollingAlpha} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Whether the headline alpha was earned recently or decades ago. Bands
            above the zero line are quarters where the mirror beat {selectedBench} on a
            trailing-year basis; bands below are quarters where it lost ground.
            A flat positive line = steady outperformance; a curve that crosses
            often = regime-dependent strategy.
          </p>
        </section>
      )}

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
            <BiggestTradesTable trades={closedTrades} asOfMs={asOfMs} />
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
  title,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  title?: string;
}) {
  return (
    <div title={title}>
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

function BiggestTradesTable({
  trades,
  asOfMs,
}: {
  trades: BacktestTrade[];
  // Snapshot's "as of" timestamp (endDate) — used to compute hold duration
  // for open trades. Passed in from the parent so render stays pure
  // (no Date.now() at render time).
  asOfMs: number;
}) {
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
            const exitT = t.exitDate
              ? new Date(t.exitDate).getTime()
              : asOfMs;
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
