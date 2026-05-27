"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  ConvictionBacktest,
  ConvictionBucket,
  ConvictionSignal,
  CurrentPick,
} from "@/lib/conviction-backtest";
import { formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type ExitMode = "today" | "fund-exit";

export function ConvictionView({ data }: { data: ConvictionBacktest }) {
  // Default to ≥4 quarters (a full year of conviction).
  const defaultIdx = Math.max(
    0,
    data.buckets.findIndex((b) => b.minHoldQuarters === 4),
  );
  const [idx, setIdx] = useState(defaultIdx);
  const [exitMode, setExitMode] = useState<ExitMode>("today");
  const bucket = data.buckets[idx];

  // Pick the appropriate headline stats based on exit mode. "today" uses the
  // existing hold-to-today logic; "fund-exit" uses the fund's actual exit
  // price (or today for still-open positions). Per-fund table, top-gainers/
  // losers, and current picks stay on the "today" basis since the comparison
  // signal lives in the headline.
  const hStats = exitMode === "today" ? bucket.stats : null;
  const feStats = exitMode === "fund-exit" ? bucket.fundExitStats : null;
  const followerFinalUsd =
    hStats?.followerFinalUsd ?? feStats?.followerFinalUsd ?? 0;
  const followerReturnPct =
    hStats?.followerReturnPct ?? feStats?.followerReturnPct ?? 0;
  const spyFinalUsd = hStats?.spyFinalUsd ?? feStats?.spyFinalUsd ?? 0;
  const alphaUsd = hStats?.alphaUsd ?? feStats?.alphaUsd ?? 0;
  const alphaPct = hStats?.alphaPct ?? feStats?.alphaPct ?? 0;
  const winRate = hStats?.winRate ?? feStats?.winRate ?? 0;
  const avgReturnPct = hStats?.avgReturnPct ?? feStats?.avgReturnPct ?? 0;
  const medianReturnPct =
    hStats?.medianReturnPct ?? feStats?.medianReturnPct ?? 0;

  return (
    <>
      <SliderControl
        buckets={data.buckets}
        idx={idx}
        onChange={setIdx}
      />

      <ExitModeToggle mode={exitMode} onChange={setExitMode} />

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
            label={exitMode === "today" ? "Held to today" : "Sold at fund exit"}
            value={formatUSD(followerFinalUsd, { compact: true })}
            tone={followerReturnPct >= 0 ? "up" : "down"}
            sub={`${followerReturnPct >= 0 ? "+" : ""}${formatPct(followerReturnPct, 1)} on capital`}
          />
          <Stat
            label="SPY ending value"
            value={formatUSD(spyFinalUsd, { compact: true })}
            sub={
              exitMode === "today"
                ? `${bucket.stats.spyReturnPct >= 0 ? "+" : ""}${formatPct(bucket.stats.spyReturnPct, 1)} on same dollars`
                : "Held over each signal's buy → fund-exit window"
            }
          />
          <Stat
            label="Alpha vs SPY"
            value={`${alphaUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(alphaUsd), { compact: true })}`}
            tone={alphaUsd >= 0 ? "up" : "down"}
            sub={`${alphaPct >= 0 ? "+" : ""}${formatPct(alphaPct, 1)} of invested capital`}
          />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Beat SPY (win rate)"
            value={`${(winRate * 100).toFixed(0)}%`}
            sub="signals with positive alpha"
          />
          <Stat
            label="Avg signal return"
            value={`${avgReturnPct >= 0 ? "+" : ""}${formatPct(avgReturnPct, 1)}`}
            tone={avgReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Median signal return"
            value={`${medianReturnPct >= 0 ? "+" : ""}${formatPct(medianReturnPct, 1)}`}
            tone={medianReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Avg fund hold"
            value={`${bucket.stats.avgHoldQuarters.toFixed(1)}Q`}
            sub={`${Math.round(bucket.stats.avgHoldQuarters * 90)} days`}
          />
        </div>

        {/* Inline delta callout: how much the exit-mode swap costs/gains */}
        <div className="mt-6 text-xs leading-relaxed text-muted">
          {exitMode === "today" ? (
            <>
              Compare:{" "}
              <button
                type="button"
                onClick={() => setExitMode("fund-exit")}
                className="text-accent underline-offset-2 transition-colors hover:underline"
              >
                If you&apos;d sold when the fund did
              </button>{" "}
              the follower would have ended at{" "}
              <span className="tabular text-foreground">
                {formatUSD(bucket.fundExitStats.followerFinalUsd, {
                  compact: true,
                })}
              </span>{" "}
              ({bucket.fundExitStats.followerReturnPct >= 0 ? "+" : ""}
              {formatPct(bucket.fundExitStats.followerReturnPct, 1)}). Holding
              longer than the fund {bucket.stats.followerFinalUsd >= bucket.fundExitStats.followerFinalUsd ? "improved" : "hurt"}{" "}
              the result by{" "}
              <span className="tabular text-foreground">
                {formatUSD(Math.abs(bucket.stats.followerFinalUsd - bucket.fundExitStats.followerFinalUsd), { compact: true })}
              </span>
              .
            </>
          ) : (
            <>
              Compare:{" "}
              <button
                type="button"
                onClick={() => setExitMode("today")}
                className="text-accent underline-offset-2 transition-colors hover:underline"
              >
                If you&apos;d held to today
              </button>{" "}
              the follower would have ended at{" "}
              <span className="tabular text-foreground">
                {formatUSD(bucket.stats.followerFinalUsd, { compact: true })}
              </span>{" "}
              ({bucket.stats.followerReturnPct >= 0 ? "+" : ""}
              {formatPct(bucket.stats.followerReturnPct, 1)}).
            </>
          )}
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

      {/* CURRENT POSITIONS ================================================== */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Currently-held positions
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            still in fund&apos;s latest 13F · ≥ {bucket.minHoldQuarters}Q held
          </span>
        </div>
        <p className="mt-2 text-xs text-muted/80">
          Research starting points, not recommendations. 13F disclosures lag
          actual trades by up to 45 days, and a fund&apos;s reason for owning
          a name often doesn&apos;t survive the move from their book to yours.
        </p>
        <CurrentPicksTable picks={bucket.currentPicks} />
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

function CurrentPicksTable({ picks }: { picks: CurrentPick[] }) {
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return picks;
    return picks.filter(
      (p) =>
        p.ticker.toLowerCase().includes(f) ||
        p.issuer.toLowerCase().includes(f) ||
        p.fundName.toLowerCase().includes(f),
    );
  }, [picks, filter]);

  const visible = showAll ? filtered : filtered.slice(0, 30);
  const hasMore = filtered.length > 30;

  return (
    <>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by ticker, issuer, or fund…"
          className="w-80 max-w-full border-b border-hairline bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
          spellCheck={false}
        />
        <span className="font-mono text-xs tabular text-muted">
          {filtered.length.toLocaleString()}
          {filtered.length !== picks.length && (
            <span> / {picks.length.toLocaleString()}</span>
          )}{" "}
          picks
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No matches.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-3 font-normal">Ticker</th>
                <th className="py-3 px-3 font-normal">Issuer</th>
                <th className="py-3 px-3 font-normal">Fund</th>
                <th className="py-3 px-3 text-right font-normal">First bought</th>
                <th className="py-3 px-3 text-right font-normal">Held</th>
                <th className="py-3 px-3 text-right font-normal">Cost</th>
                <th className="py-3 px-3 text-right font-normal">Now</th>
                <th className="py-3 px-3 text-right font-normal">Return</th>
                <th className="py-3 pl-3 text-right font-normal">Alpha</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p, i) => (
                <tr
                  key={`${p.fundCik}-${p.cusip}-${i}`}
                  className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                >
                  <td className="py-3 pr-3 font-mono text-sm text-foreground">
                    {p.ticker}
                  </td>
                  <td className="py-3 px-3 font-serif text-foreground/90">
                    <span className="line-clamp-1">{p.issuer}</span>
                  </td>
                  <td className="py-3 px-3">
                    <Link
                      href={`/fund/${p.fundCik}/performance`}
                      className="text-xs text-muted transition-colors hover:text-accent"
                    >
                      {p.fundName}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-muted">
                    {quarterLabel(p.firstBuyDate)}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {(p.currentHoldDays / 90).toFixed(1)}Q
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    ${p.buyPrice.toFixed(p.buyPrice < 10 ? 2 : 0)}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-foreground">
                    ${p.todayPrice.toFixed(p.todayPrice < 10 ? 2 : 0)}
                  </td>
                  <td
                    className={cn(
                      "py-3 px-3 text-right tabular",
                      p.returnPct >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {p.returnPct >= 0 ? "+" : ""}
                    {formatPct(p.returnPct, 0)}
                  </td>
                  <td
                    className={cn(
                      "py-3 pl-3 text-right tabular text-xs",
                      p.alphaPct >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {p.alphaPct >= 0 ? "+" : ""}
                    {formatPct(p.alphaPct, 0)} vs SPY
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 text-xs uppercase tracking-widest text-accent transition-opacity hover:opacity-70"
        >
          {showAll
            ? "↑ Show top 30"
            : `↓ Show all ${filtered.length.toLocaleString()}`}
        </button>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Each row is a position the fund is still holding in their latest
        13F, that has been held for at least {""}
        {/* dynamic message replaced by parent's slider state */}
        the selected conviction filter. Sorted by current hold duration
        (longest first = strongest conviction). &ldquo;Cost&rdquo; is the
        price at the first disclosure; a follower buying today pays the
        &ldquo;Now&rdquo; price, so their forward return won&apos;t mirror
        the column shown here.
      </p>
    </>
  );
}

function ExitModeToggle({
  mode,
  onChange,
}: {
  mode: ExitMode;
  onChange: (m: ExitMode) => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-baseline gap-3 text-xs uppercase tracking-widest text-muted">
      <span>Exit when</span>
      <div className="inline-flex overflow-hidden rounded border border-hairline">
        <button
          type="button"
          onClick={() => onChange("today")}
          className={cn(
            "px-3 py-1 transition-colors",
            mode === "today"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          Hold to today
        </button>
        <button
          type="button"
          onClick={() => onChange("fund-exit")}
          className={cn(
            "border-l border-hairline px-3 py-1 transition-colors",
            mode === "fund-exit"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          Sell when fund sold
        </button>
      </div>
      <span className="normal-case tracking-normal text-muted/70">
        {mode === "today"
          ? "Ignore fund's exit; mark to current price."
          : "Match fund's sell date (or today if still held)."}
      </span>
    </div>
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
