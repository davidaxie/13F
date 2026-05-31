"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  EnrichedSignal,
  FollowerBacktest,
  PerFundSummary,
  RealizedPoint,
} from "@/lib/follower-backtest";
import { CumulativeAlphaChart } from "@/components/charts/cumulative-alpha";
import { formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  base: FollowerBacktest;
  topGainers: EnrichedSignal[];
  topLosers: EnrichedSignal[];
};

// Slider presets — log-spaced so each step doubles position size.
const PRESETS = [
  500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
] as const;

export function FollowerView({ base, topGainers, topLosers }: Props) {
  const [size, setSize] = useState<number>(base.positionSizeUsd);
  const [slipBps, setSlipBps] = useState<number>(0); // 0 = gross
  const k = size / base.positionSizeUsd; // size multiplier

  // Pick the precomputed cost variant matching the selected slippage.
  // Falls back to the 0bps variant if for some reason the requested level
  // isn't in costVariants (shouldn't happen — defaults are [0,5,10,25]).
  const costVariant =
    base.costVariants.find((v) => v.bpsPerSide === slipBps) ??
    base.costVariants[0];

  // Rescale every dollar amount by k. Percentages, dates, counts unchanged.
  // When slipBps > 0, override the headline-affecting fields with the
  // cost-adjusted variant AND apply the same proportional slip to each
  // per-fund row so the table moves with the toggle.
  //
  // Slip math: each signal pays `slip` on the buy side and receives `slip`
  // less on the sell side, so net follower-final = gross * (1-slip)/(1+slip)
  // applied uniformly. This is exactly what computeCostVariants does at the
  // aggregate level — we just propagate the same factor per-fund here.
  // SPY is assumed cost-free (matches the aggregate convention).
  const slipFactor = (1 - slipBps / 10000) / (1 + slipBps / 10000);
  const view = useMemo(() => {
    const stats = {
      ...base.stats,
      totalInvestedUsd: base.stats.totalInvestedUsd * k,
      followerFinalUsd: costVariant.followerFinalUsd * k,
      spyFinalUsd: base.stats.spyFinalUsd * k,
      alphaUsd: costVariant.alphaUsd * k,
      followerReturnPct: costVariant.followerReturnPct,
      alphaPct: costVariant.alphaPct,
      winRate: costVariant.winRate,
      avgReturnPct: costVariant.avgReturnPct,
      medianReturnPct: costVariant.medianReturnPct,
    };
    const perFund: PerFundSummary[] = base.perFund.map((f) => {
      const followerFinalAdj = f.followerFinal * slipFactor;
      const investedScaled = f.invested * k;
      const followerFinalScaled = followerFinalAdj * k;
      const spyFinalScaled = f.spyFinal * k;
      const alphaUsdScaled = followerFinalScaled - spyFinalScaled;
      const followerReturnPctAdj =
        f.invested > 0 ? ((followerFinalAdj - f.invested) / f.invested) * 100 : 0;
      const alphaPctAdj =
        f.invested > 0
          ? ((followerFinalAdj - f.spyFinal) / f.invested) * 100
          : 0;
      return {
        ...f,
        invested: investedScaled,
        followerFinal: followerFinalScaled,
        spyFinal: spyFinalScaled,
        alphaUsd: alphaUsdScaled,
        followerReturnPct: followerReturnPctAdj,
        alphaPct: alphaPctAdj,
      };
    });
    const realizedSeries: RealizedPoint[] = base.realizedSeries.map((p) => ({
      date: p.date,
      cumulativeFollowerPnlUsd: p.cumulativeFollowerPnlUsd * k,
      cumulativeSpyPnlUsd: p.cumulativeSpyPnlUsd * k,
      cumulativeAlphaUsd: p.cumulativeAlphaUsd * k,
    }));
    return { stats, perFund, realizedSeries };
  }, [base, k, costVariant, slipFactor]);

  return (
    <>
      {/* SLIDER ============================================================= */}
      <SliderControl size={size} onChange={setSize} />

      {/* SLIPPAGE TOGGLE ==================================================== */}
      <SlippageControl
        bps={slipBps}
        onChange={setSlipBps}
        availableBps={base.costVariants.map((v) => v.bpsPerSide)}
      />

      {/* Headline =========================================================== */}
      <section className="mt-12">
        <div className="border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">Headline</h2>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4">
          <Stat
            label="Total invested"
            value={formatUSD(view.stats.totalInvestedUsd, { compact: true })}
            sub={`${view.stats.totalSignals.toLocaleString()} signals × $${(size / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`}
          />
          <Stat
            label="Follower ending value"
            value={formatUSD(view.stats.followerFinalUsd, { compact: true })}
            tone={view.stats.followerReturnPct >= 0 ? "up" : "down"}
            sub={`${view.stats.followerReturnPct >= 0 ? "+" : ""}${formatPct(view.stats.followerReturnPct, 1)} on capital`}
          />
          <Stat
            label="SPY ending value"
            value={formatUSD(view.stats.spyFinalUsd, { compact: true })}
            sub={`${view.stats.spyReturnPct >= 0 ? "+" : ""}${formatPct(view.stats.spyReturnPct, 1)} on same dollars`}
          />
          <Stat
            label="Alpha vs SPY"
            value={`${view.stats.alphaUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(view.stats.alphaUsd), { compact: true })}`}
            tone={view.stats.alphaUsd >= 0 ? "up" : "down"}
            sub={`${view.stats.alphaPct >= 0 ? "+" : ""}${formatPct(view.stats.alphaPct, 1)} of invested capital`}
          />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Beat SPY (win rate)"
            value={`${(view.stats.winRate * 100).toFixed(0)}%`}
            sub="signals with positive alpha"
          />
          <Stat
            label="Avg signal return"
            value={`${view.stats.avgReturnPct >= 0 ? "+" : ""}${formatPct(view.stats.avgReturnPct, 1)}`}
            tone={view.stats.avgReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Median signal return"
            value={`${view.stats.medianReturnPct >= 0 ? "+" : ""}${formatPct(view.stats.medianReturnPct, 1)}`}
            tone={view.stats.medianReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Avg hold"
            value={`${Math.round(view.stats.avgHoldDays)}d`}
            sub={
              view.stats.avgHoldDays > 60
                ? `${(view.stats.avgHoldDays / 90).toFixed(1)} quarters`
                : undefined
            }
          />
        </div>
      </section>

      {/* Realized P&L curve ================================================= */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Realized P&amp;L curve
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            Cumulative profit · follower vs SPY
          </span>
        </div>
        <div className="mt-6">
          <CumulativeAlphaChart data={view.realizedSeries} />
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="inline-block h-[2px] w-6 bg-foreground" />
            Follower P&amp;L (realized)
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-[2px] w-6"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--muted) 50%, transparent 50%)",
                backgroundSize: "6px 2px",
              }}
            />
            SPY P&amp;L over the same windows
          </span>
        </div>
      </section>

      {/* Per-fund =========================================================== */}
      <section className="mt-20">
        <div className="border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Per-fund contribution
          </h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-3 font-normal">Fund</th>
                <th className="py-3 px-3 text-right font-normal">Signals</th>
                <th className="py-3 px-3 text-right font-normal">Invested</th>
                <th className="py-3 px-3 text-right font-normal">Follower</th>
                <th className="py-3 px-3 text-right font-normal">SPY</th>
                <th className="py-3 px-3 text-right font-normal">Alpha</th>
                <th className="py-3 px-3 text-right font-normal">Return</th>
                <th className="py-3 pl-3 text-right font-normal">Win</th>
              </tr>
            </thead>
            <tbody>
              {view.perFund.map((f) => (
                <tr
                  key={f.fundCik}
                  className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                >
                  <td className="py-3 pr-3 text-foreground">
                    <Link
                      href={`/fund/${f.fundCik}/performance`}
                      className="font-serif text-base leading-tight hover:text-accent"
                    >
                      {f.fundName}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {f.signals.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {formatUSD(f.invested, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-foreground">
                    {formatUSD(f.followerFinal, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {formatUSD(f.spyFinal, { compact: true })}
                  </td>
                  <td
                    className={cn(
                      "py-3 px-3 text-right tabular",
                      f.alphaUsd >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {f.alphaUsd >= 0 ? "+" : "−"}
                    {formatUSD(Math.abs(f.alphaUsd), { compact: true })}
                  </td>
                  <td
                    className={cn(
                      "py-3 px-3 text-right tabular",
                      f.followerReturnPct >= 0
                        ? "text-positive"
                        : "text-negative",
                    )}
                  >
                    {f.followerReturnPct >= 0 ? "+" : ""}
                    {formatPct(f.followerReturnPct, 1)}
                  </td>
                  <td className="py-3 pl-3 text-right tabular text-muted">
                    {(f.winRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top movers ========================================================= */}
      <section className="mt-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <SignalList
            title="Biggest alpha winners"
            signals={topGainers}
            scaleK={k}
          />
          <SignalList
            title="Biggest alpha losses"
            signals={topLosers}
            scaleK={k}
            negative
          />
        </div>
      </section>
    </>
  );
}

function SlippageControl({
  bps,
  onChange,
  availableBps,
}: {
  bps: number;
  onChange: (v: number) => void;
  availableBps: number[];
}) {
  const label = bps === 0 ? "Gross (no slippage)" : `Net of ${bps} bps per side`;
  const subtext =
    bps === 0
      ? "Headline figures assume frictionless execution at the filing-date price."
      : `Buy paid ${bps} bps above the print, sell received ${bps} bps below. Round-trip cost ≈ ${bps * 2} bps per signal. Per-fund returns shift with this toggle; the realized P&L chart still shows gross.`;
  return (
    <div className="mt-6 rounded border border-hairline px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-xs uppercase tracking-widest text-muted">
          Slippage assumption
        </div>
        <div className="font-serif text-lg tabular text-foreground">
          {label}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {availableBps.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onChange(b)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition-colors",
              bps === b
                ? "border-foreground bg-foreground text-background"
                : "border-hairline text-muted hover:border-foreground hover:text-foreground",
            )}
          >
            {b === 0 ? "Gross" : `${b} bps`}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{subtext}</p>
    </div>
  );
}

function SliderControl({
  size,
  onChange,
}: {
  size: number;
  onChange: (v: number) => void;
}) {
  // Continuous slider value 0..(PRESETS.length-1), interpolated.
  const idx = presetIndex(size);
  const minVal = PRESETS[0];
  const maxVal = PRESETS[PRESETS.length - 1];

  return (
    <div className="mt-12 rounded border border-hairline px-6 py-5">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest text-muted">
          Position size per signal
        </div>
        <div className="font-serif text-2xl tabular text-foreground">
          {formatUSD(size, { compact: false })}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={PRESETS.length - 1}
        step={0.01}
        value={idx}
        onChange={(e) => onChange(presetValue(Number(e.target.value)))}
        className="mt-4 w-full accent-foreground"
      />

      <div className="mt-2 flex justify-between text-xs tabular text-muted">
        <span>{formatUSD(minVal, { compact: true })}</span>
        {PRESETS.slice(1, -1).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="hover:text-foreground transition-colors"
          >
            {formatUSD(v, { compact: true })}
          </button>
        ))}
        <span>{formatUSD(maxVal, { compact: true })}</span>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Slide to size every individual buy signal differently. Percentages
        (returns, alpha %, win rate) don&apos;t change — only the dollar
        figures rescale, since each signal&apos;s P&amp;L is linear in
        position size.
      </p>
    </div>
  );
}

function presetIndex(size: number): number {
  // Map dollar amount → continuous index on log scale through PRESETS.
  if (size <= PRESETS[0]) return 0;
  if (size >= PRESETS[PRESETS.length - 1]) return PRESETS.length - 1;
  for (let i = 1; i < PRESETS.length; i++) {
    if (size <= PRESETS[i]) {
      const lo = PRESETS[i - 1];
      const hi = PRESETS[i];
      const frac =
        (Math.log(size) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
      return i - 1 + frac;
    }
  }
  return PRESETS.length - 1;
}

function presetValue(idx: number): number {
  const clamped = Math.max(0, Math.min(PRESETS.length - 1, idx));
  const lo = PRESETS[Math.floor(clamped)];
  const hi = PRESETS[Math.min(PRESETS.length - 1, Math.ceil(clamped))];
  const frac = clamped - Math.floor(clamped);
  const v = Math.exp(Math.log(lo) + frac * (Math.log(hi) - Math.log(lo)));
  // Snap to nearest $100 to keep the readout clean.
  return Math.round(v / 100) * 100;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
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
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function SignalList({
  title,
  signals,
  scaleK,
  negative,
}: {
  title: string;
  signals: EnrichedSignal[];
  scaleK: number;
  negative?: boolean;
}) {
  return (
    <div>
      <div className="border-b border-hairline pb-3">
        <h3 className="font-serif text-xl text-foreground">{title}</h3>
      </div>
      <ul className="divide-y divide-hairline/60">
        {signals.map((s, i) => (
          <li key={`${s.fundCik}-${s.cusip}-${s.buyDate}-${i}`}>
            <Link
              href={`/fund/${s.fundCik}/performance`}
              className="group block py-3 transition-colors hover:bg-subtle/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-base leading-tight text-foreground transition-colors group-hover:text-accent">
                    {s.ticker} <span className="text-muted">·</span>{" "}
                    <span className="text-muted text-sm">{s.issuer}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {s.fundName} · {quarterLabel(s.buyDate)} →{" "}
                    {s.sellDate ? quarterLabel(s.sellDate) : "open"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      "tabular text-sm",
                      negative ? "text-negative" : "text-positive",
                    )}
                  >
                    {negative ? "−" : "+"}
                    {formatUSD(Math.abs(s.alphaUsd) * scaleK, {
                      compact: true,
                    })}
                  </div>
                  <div className="mt-0.5 text-xs text-muted tabular">
                    {s.returnPct >= 0 ? "+" : ""}
                    {formatPct(s.returnPct, 0)} vs SPY{" "}
                    {s.spyReturnPct >= 0 ? "+" : ""}
                    {formatPct(s.spyReturnPct, 0)}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
