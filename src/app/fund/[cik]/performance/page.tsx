import Link from "next/link";
import { notFound } from "next/navigation";
import { CaveatCallout } from "@/components/caveat-callout";
import { DrawdownChart } from "@/components/charts/drawdown";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { PnlStairstepChart } from "@/components/charts/pnl-stairstep";
import { RollingAlphaChart } from "@/components/charts/rolling-alpha";
import { TradeScatterChart } from "@/components/charts/trade-scatter";
import { getFundInfo } from "@/lib/edgar";
import { type BacktestTrade } from "@/lib/backtest";
import { MARQUEE_FUNDS } from "@/lib/funds";
import {
  BENCHMARKS,
  BENCHMARK_KEYS,
  isBenchmark,
  rekeyEquityCurve,
  type BenchmarkKey,
} from "@/lib/benchmarks";
import {
  FACTOR_META,
  FACTOR_ORDER,
  decomposeFactors,
} from "@/lib/factor-decomp";
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

  // The performance backtest is served ONLY from a pre-computed snapshot.
  // We deliberately do NOT run a live backtest here: for heavy multi-strat
  // books (D.E. Shaw, Millennium, …) a full SEC+Yahoo replay can't finish
  // inside Vercel's 60s function limit and the page 504s. Funds without a
  // snapshot get a graceful "pending" state instead — the weekly cron fills
  // snapshots in, and the fund's overview/holdings/ownership/insider pages
  // (which ARE live) still work.
  const snapshot = getSnapshot(cik);

  let info;
  try {
    info = await getFundInfo(cik, "recent");
  } catch {
    notFound();
  }
  if (!info.name) notFound();

  if (!snapshot) {
    const cleanCik = info.cik.replace(/^0+/, "");
    const isTracked = MARQUEE_FUNDS.some((f) => f.cik === cleanCik);
    return <PendingBacktest cik={info.cik} name={info.name} isTracked={isTracked} />;
  }

  const result = snapshot;

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

  // The page narrative is "$10k mirrored" — but stats.realizedPnlUsd is the
  // full-book equivalent (sum of raw 13F trade P&L). Scale it to the mirror
  // so the headline matches the story. mirrorRealizedPnlUsd ≈
  // realizedPnlUsd × (startingCash / firstFilingTotalValueUsd).
  const firstEntryDate = trades.reduce<string | null>((acc, t) => {
    if (!acc || t.entryDate < acc) return t.entryDate;
    return acc;
  }, null);
  const firstFilingTotalValueUsd = firstEntryDate
    ? trades.reduce(
        (sum, t) => (t.entryDate === firstEntryDate ? sum + t.entryValueUsd : sum),
        0,
      )
    : 0;
  const mirrorScale =
    firstFilingTotalValueUsd > 0 ? startingCash / firstFilingTotalValueUsd : 0;
  const mirrorRealizedPnlUsd = result.stats.realizedPnlUsd * mirrorScale;

  // Risk metrics derived from the existing weekly equity curve — no snapshot
  // regeneration needed.
  const risk = computeRiskMetrics(equityCurve);
  const rollingAlpha = computeRollingAlpha(equityCurve, 52);
  // Style decomposition uses the original (SPY-keyed) curve regardless of
  // the user-selected benchmark — its factors come from SPY/IWM/QQQ/EFA/AGG
  // directly. Pass result.equityCurve, not the rekeyed `equityCurve`.
  const decomp = decomposeFactors(result.equityCurve);

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
            label={`Excess return vs ${selectedBench}`}
            value={`${stats.alphaPct >= 0 ? "+" : ""}${formatPct(stats.alphaPct, 1)}`}
            tone={stats.alphaPct >= 0 ? "up" : "down"}
            title={`(Mirror final − ${selectedBench} final) ÷ starting cash. Cumulative dollar outperformance vs the benchmark — not factor alpha (see Jensen α / style α below).`}
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

      {/* ============ A.7b Style decomposition ============ */}
      {decomp && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="font-serif text-2xl text-foreground">
              Style decomposition
            </h2>
            <span className="text-xs uppercase tracking-widest text-muted">
              R² {(decomp.r2 * 100).toFixed(0)}% · {decomp.observations} weekly obs
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
            Multivariate regression of weekly mirror excess return on five
            style factors built from the benchmark ETFs: SPY (market),
            IWM−SPY (size), QQQ−SPY (growth), EFA−SPY (international),
            AGG−SPY (bonds). The intercept is the &ldquo;true alpha&rdquo;
            after stripping these passive tilts. ✓ marks loadings whose
            |t-stat| ≥ 2 (≈ 95% confidence the loading is non-zero).
          </p>

          <div className="mt-6 grid gap-3">
            {FACTOR_ORDER.map((fk) => {
              const l = decomp.loadings[fk];
              const widthPct = Math.min(100, Math.abs(l.beta) * 50); // |1.0| = 50% of half-axis
              const positive = l.beta >= 0;
              const significant = Math.abs(l.tStat) >= 2;
              return (
                <div
                  key={fk}
                  className="grid grid-cols-[150px_minmax(0,1fr)_100px] items-center gap-3 rounded px-2 py-1.5"
                  title={FACTOR_META[fk].description}
                >
                  <div className="text-xs uppercase tracking-widest text-muted">
                    {FACTOR_META[fk].label}
                  </div>
                  <div className="relative h-5">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
                    <div
                      className={cn(
                        "absolute inset-y-0 rounded-sm",
                        positive ? "left-1/2 bg-positive/60" : "right-1/2 bg-negative/60",
                      )}
                      style={{ width: `${widthPct / 2}%` }}
                    />
                  </div>
                  <div className="text-right text-sm tabular">
                    <span
                      className={cn(
                        positive ? "text-positive" : "text-negative",
                      )}
                    >
                      {positive ? "+" : ""}
                      {l.beta.toFixed(2)}
                    </span>
                    {significant && (
                      <span
                        className="ml-1 text-[10px] text-muted"
                        title={`t-stat ${l.tStat.toFixed(2)}`}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-4 border-t border-hairline pt-6 sm:grid-cols-4">
            <Stat
              label="α (style-adjusted)"
              value={`${decomp.alphaAnnualPct >= 0 ? "+" : ""}${decomp.alphaAnnualPct.toFixed(1)}%`}
              tone={decomp.alphaAnnualPct >= 0 ? "up" : "down"}
              title={`Annualized regression intercept. t-stat ${decomp.alphaTStat.toFixed(2)} (${Math.abs(decomp.alphaTStat) >= 2 ? "significant" : "not significant"} at 95%).`}
            />
            <Stat
              label="R²"
              value={`${(decomp.r2 * 100).toFixed(0)}%`}
              title="Share of mirror's excess return variance explained by the five factors. High R² + small alpha = the fund is doing exactly what its style suggests; low R² = there's something the style model misses."
            />
            <Stat
              label="α t-stat"
              value={decomp.alphaTStat.toFixed(2)}
              tone={
                Math.abs(decomp.alphaTStat) >= 2
                  ? decomp.alphaTStat > 0
                    ? "up"
                    : "down"
                  : undefined
              }
              title="|t| ≥ 2 ≈ 95% confidence the alpha is non-zero."
            />
            <Stat
              label="Observations"
              value={decomp.observations.toLocaleString()}
              title="Weekly samples used in the regression."
            />
          </div>
        </section>
      )}

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
          <PnlStairstepChart data={pnlSeries} mirrorScale={mirrorScale} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Realized P&L"
            value={`${mirrorRealizedPnlUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(mirrorRealizedPnlUsd), { compact: true })}`}
            tone={mirrorRealizedPnlUsd >= 0 ? "up" : "down"}
            title={`Scaled to the $${startingCash.toLocaleString()} mirror. Full-book equivalent ${stats.realizedPnlUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(stats.realizedPnlUsd), { compact: true })}.`}
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

/**
 * Per-fund explanation for why a tracked fund's snapshot is missing.
 * Some funds have a structural blocker (parser doesn't support their
 * pre-2012 13F format; CUSIP→ticker map doesn't cover their universe)
 * that won't resolve on the next weekly cron run — we say so explicitly
 * rather than pretending a passive wait will fix it. Unknown CIKs fall
 * through to the generic "weekly cron" copy (the only honest answer for
 * tracked funds where we don't have a specific diagnosis).
 */
function PendingCopy({ cik, name }: { cik: string; name: string }) {
  if (cik === "1345472") {
    // Trian — historical 13Fs are in the legacy paper/non-XML format.
    return (
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        {name}&apos;s pre-2012 13F filings aren&apos;t in the structured
        XML format our parser supports, so the snapshot pipeline can&apos;t
        replay their trade history. The next weekly cron run won&apos;t
        change that — extending the parser to handle the legacy format is
        what unblocks it.
      </p>
    );
  }
  if (cik === "1517137") {
    // Starboard — small-cap activist universe is sparsely covered by
    // the bundled CUSIP→ticker seed.
    return (
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        Only about 28% of {name}&apos;s small-cap activist universe maps to
        a ticker via the bundled CUSIP seed file, so the mirror would be
        missing most positions. Filling the gaps needs an OpenFIGI API
        key (which we don&apos;t bundle); the next weekly cron run
        won&apos;t fix it on its own.
      </p>
    );
  }
  return (
    <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
      {name} is a tracked fund, but its $10k-mirror backtest snapshot
      hasn&apos;t been generated yet. Snapshots are produced by a weekly
      job; this one will appear after the next run. We render backtests
      from pre-computed snapshots rather than live — a full SEC + price
      replay for a large book can&apos;t finish inside the serverless time
      limit.
    </p>
  );
}

// Graceful state when a fund has no pre-computed snapshot. Rendered instead
// of a live backtest (which would 504 on Vercel for heavy funds). Honest
// about why, and routes the user to the live data that DOES work.
function PendingBacktest({
  cik,
  name,
  isTracked,
}: {
  cik: string;
  name: string;
  isTracked: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href={`/fund/${cik}`}
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← {name}
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Backtest
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          {name}
        </h1>
      </div>

      <section className="mt-12 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-8">
        <h2 className="font-serif text-2xl text-foreground">
          Performance backtest pending
        </h2>
        {isTracked ? (
          // Per-fund tailoring of the pending copy: a generic "weekly
          // cron will fill it in" message is wrong for funds whose
          // snapshot is blocked by an upstream gap (parser limitation,
          // missing CUSIP→ticker map), since the next cron run won't
          // help. The cleanCik used here is the leading-zero-stripped
          // form, matching the keys in src/lib/funds.ts.
          <PendingCopy cik={cik.replace(/^0+/, "")} name={name} />
        ) : (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Backtests are pre-computed for the tracked marquee funds only.
            {name} isn&apos;t in that set, so there&apos;s no performance
            snapshot for it.
          </p>
        )}

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          Everything else for this fund is live and available now:
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/fund/${cik}`}
            className="inline-flex items-center gap-2 border-b border-accent/30 pb-0.5 text-sm text-accent transition-colors hover:border-accent"
          >
            Holdings, ownership &amp; insider activity →
          </Link>
        </div>
      </section>
    </div>
  );
}
