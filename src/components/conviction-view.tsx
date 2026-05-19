"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  ConvictionBacktest,
  ConvictionBucket,
  ConvictionSignal,
} from "@/lib/conviction-backtest";
import { formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConvictionView({ data }: { data: ConvictionBacktest }) {
  // Default to ≥4 quarters (a full year of conviction).
  const defaultIdx = Math.max(
    0,
    data.buckets.findIndex((b) => b.minHoldQuarters === 4),
  );
  const [idx, setIdx] = useState(defaultIdx);
  const bucket = data.buckets[idx];

  return (
    <>
      <SliderControl
        buckets={data.buckets}
        idx={idx}
        onChange={setIdx}
      />

      {/* Headline ============================================================= */}
      <section className="mt-12">
        <div className="border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">Headline</h2>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4">
          <Stat
            label="Total invested"
            value={formatUSD(bucket.stats.totalInvestedUsd, { compact: true })}
            sub={`${bucket.stats.totalSignals.toLocaleString()} signals × $${(data.positionSizeUsd / 1000).toFixed(0)}k`}
          />
          <Stat
            label="Held to today"
            value={formatUSD(bucket.stats.followerFinalUsd, { compact: true })}
            tone={bucket.stats.followerReturnPct >= 0 ? "up" : "down"}
            sub={`${bucket.stats.followerReturnPct >= 0 ? "+" : ""}${formatPct(bucket.stats.followerReturnPct, 1)} on capital`}
          />
          <Stat
            label="SPY ending value"
            value={formatUSD(bucket.stats.spyFinalUsd, { compact: true })}
            sub={`${bucket.stats.spyReturnPct >= 0 ? "+" : ""}${formatPct(bucket.stats.spyReturnPct, 1)} on same dollars`}
          />
          <Stat
            label="Alpha vs SPY"
            value={`${bucket.stats.alphaUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(bucket.stats.alphaUsd), { compact: true })}`}
            tone={bucket.stats.alphaUsd >= 0 ? "up" : "down"}
            sub={`${bucket.stats.alphaPct >= 0 ? "+" : ""}${formatPct(bucket.stats.alphaPct, 1)} of invested capital`}
          />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Beat SPY (win rate)"
            value={`${(bucket.stats.winRate * 100).toFixed(0)}%`}
            sub="signals with positive alpha"
          />
          <Stat
            label="Avg signal return"
            value={`${bucket.stats.avgReturnPct >= 0 ? "+" : ""}${formatPct(bucket.stats.avgReturnPct, 1)}`}
            tone={bucket.stats.avgReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Median signal return"
            value={`${bucket.stats.medianReturnPct >= 0 ? "+" : ""}${formatPct(bucket.stats.medianReturnPct, 1)}`}
            tone={bucket.stats.medianReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Avg fund hold"
            value={`${bucket.stats.avgHoldQuarters.toFixed(1)}Q`}
            sub={`${Math.round(bucket.stats.avgHoldQuarters * 90)} days`}
          />
        </div>
      </section>

      {/* Sweep chart: alpha at each min-hold level ============================ */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Alpha by conviction level
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            Higher conviction = longer fund hold
          </span>
        </div>
        <div className="mt-8">
          <SweepBars buckets={data.buckets} selectedIdx={idx} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Each bar is the aggregate alpha-vs-SPY of signals where the fund
          held the position for at least N quarters. Click any bar to jump
          to that filter level. Longer-held positions = stronger conviction
          but smaller sample.
        </p>
      </section>

      {/* Per-fund ============================================================= */}
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
                <th className="py-3 px-3 text-right font-normal">Held to today</th>
                <th className="py-3 px-3 text-right font-normal">SPY</th>
                <th className="py-3 px-3 text-right font-normal">Alpha</th>
                <th className="py-3 pl-3 text-right font-normal">Return</th>
              </tr>
            </thead>
            <tbody>
              {bucket.perFund.map((f) => (
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
                      "py-3 pl-3 text-right tabular",
                      f.followerReturnPct >= 0
                        ? "text-positive"
                        : "text-negative",
                    )}
                  >
                    {f.followerReturnPct >= 0 ? "+" : ""}
                    {formatPct(f.followerReturnPct, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top winners / losers ================================================= */}
      <section className="mt-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <SignalList title="Top alpha winners" signals={bucket.topGainers} />
          <SignalList
            title="Biggest alpha losses"
            signals={bucket.topLosers}
            negative
          />
        </div>
      </section>
    </>
  );
}

function SliderControl({
  buckets,
  idx,
  onChange,
}: {
  buckets: ConvictionBucket[];
  idx: number;
  onChange: (i: number) => void;
}) {
  const b = buckets[idx];
  return (
    <div className="mt-12 rounded border border-hairline px-6 py-5">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest text-muted">
          Conviction filter — min quarters held by fund
        </div>
        <div className="font-serif text-2xl tabular text-foreground">
          ≥ {b.minHoldQuarters}Q
          <span className="ml-2 text-sm text-muted">
            ({(b.minHoldQuarters * 90 / 30).toFixed(0)}+ months)
          </span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={buckets.length - 1}
        step={1}
        value={idx}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 w-full accent-foreground"
      />

      <div className="mt-2 grid grid-cols-11 text-center text-xs tabular text-muted">
        {buckets.map((bk, i) => (
          <button
            key={bk.minHoldQuarters}
            type="button"
            onClick={() => onChange(i)}
            className={cn(
              "transition-colors hover:text-foreground",
              i === idx && "font-mono font-semibold text-foreground",
            )}
          >
            {bk.minHoldQuarters}Q
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Filter signals to positions the fund held for at least N quarters
        (consistent reporting across N consecutive 13Fs). All trades exit at
        today&apos;s price — not the fund&apos;s exit — modeling a follower
        who uses 13F as an idea source but holds longer.
      </p>
    </div>
  );
}

function SweepBars({
  buckets,
  selectedIdx,
}: {
  buckets: ConvictionBucket[];
  selectedIdx: number;
}) {
  const maxAbsAlphaPct = Math.max(
    1,
    ...buckets.map((b) => Math.abs(b.stats.alphaPct)),
  );

  return (
    <div className="space-y-2">
      {buckets.map((b, i) => {
        const widthPct = (Math.abs(b.stats.alphaPct) / maxAbsAlphaPct) * 100;
        const positive = b.stats.alphaPct >= 0;
        return (
          <div
            key={b.minHoldQuarters}
            className={cn(
              "grid grid-cols-[60px_minmax(0,1fr)_140px] items-center gap-3 rounded px-2 py-1 transition-colors",
              i === selectedIdx && "bg-subtle/60",
            )}
          >
            <div className="font-mono text-xs uppercase tracking-wider text-muted">
              ≥ {b.minHoldQuarters}Q
            </div>
            <div className="relative h-6">
              <div className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
              <div
                className={cn(
                  "absolute inset-y-0",
                  positive ? "left-1/2 bg-positive/50" : "right-1/2 bg-negative/50",
                )}
                style={{ width: `${widthPct / 2}%` }}
              />
            </div>
            <div className="text-right text-xs tabular">
              <span
                className={cn(
                  positive ? "text-positive" : "text-negative",
                )}
              >
                {positive ? "+" : ""}
                {formatPct(b.stats.alphaPct, 1)} alpha
              </span>
              <span className="ml-2 text-muted">
                {b.stats.totalSignals.toLocaleString()} sig
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  negative,
}: {
  title: string;
  signals: ConvictionSignal[];
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
                    {s.fundName} · bought {quarterLabel(s.buyDate)} · held{" "}
                    {(s.positionHoldDays / 90).toFixed(1)}Q
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
                    {formatUSD(Math.abs(s.alphaUsd), { compact: true })}
                  </div>
                  <div className="mt-0.5 text-xs text-muted tabular">
                    {s.returnPct >= 0 ? "+" : ""}
                    {formatPct(s.returnPct, 0)}% vs SPY{" "}
                    {s.spyReturnPct >= 0 ? "+" : ""}
                    {formatPct(s.spyReturnPct, 0)}%
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
