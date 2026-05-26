"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Move } from "@/lib/dashboard";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_VISIBLE = 12;

type RankMode = "dollar" | "weight";

type Section = {
  key: string;
  title: string;
  subtitle: string;
  moves: Move[];
  tone: "positive" | "negative";
  valueOf: (m: Move) => number; // dollar amount to display per row
  // Weight delta — positive magnitude, in percentage points of fund portfolio.
  // For new: current weight. For exited: prev weight. For added/trimmed:
  // |current − prev|.
  valueOfPct: (m: Move) => number;
};

export function CrossFundHighlightsView({
  newLong,
  shortOpens,
  callOpens,
  exits,
  adds,
  trims,
}: {
  newLong: Move[];
  shortOpens: Move[];
  callOpens: Move[];
  exits: Move[];
  adds: Move[];
  trims: Move[];
}) {
  const [mode, setMode] = useState<RankMode>("dollar");

  const deltaWeight = (m: Move) =>
    Math.abs(m.weightInPortfolio - (m.prevWeightInPortfolio ?? 0));

  const sections: Section[] = [
    {
      key: "newLong",
      title: "New long positions",
      subtitle: "Opened this quarter · common stock",
      moves: newLong,
      tone: "positive",
      valueOf: (m) => m.currentValueUsd,
      valueOfPct: (m) => m.weightInPortfolio,
    },
    {
      key: "exits",
      title: "Exits",
      subtitle: "Fully sold out · common stock",
      moves: exits,
      tone: "negative",
      valueOf: (m) => m.prevValueUsd,
      // For exits, weightInPortfolio already reflects the prev (pre-exit)
      // weight (see dashboard.ts).
      valueOfPct: (m) => m.weightInPortfolio,
    },
    {
      key: "shortOpens",
      title: "Short bets opened",
      subtitle: "New put positions · bearish",
      moves: shortOpens,
      tone: "negative",
      valueOf: (m) => m.currentValueUsd,
      valueOfPct: (m) => m.weightInPortfolio,
    },
    {
      key: "callOpens",
      title: "Call options opened",
      subtitle: "New call positions · bullish",
      moves: callOpens,
      tone: "positive",
      valueOf: (m) => m.currentValueUsd,
      valueOfPct: (m) => m.weightInPortfolio,
    },
    {
      key: "adds",
      title: "Biggest adds",
      subtitle:
        mode === "dollar"
          ? "Largest dollar additions"
          : "Largest portfolio-weight additions",
      moves: adds,
      tone: "positive",
      valueOf: (m) => Math.abs(m.deltaUsd),
      valueOfPct: deltaWeight,
    },
    {
      key: "trims",
      title: "Biggest trims",
      subtitle:
        mode === "dollar"
          ? "Largest dollar reductions"
          : "Largest portfolio-weight reductions",
      moves: trims,
      tone: "negative",
      valueOf: (m) => Math.abs(m.deltaUsd),
      valueOfPct: deltaWeight,
    },
  ];

  return (
    <>
      <RankToggle mode={mode} onChange={setMode} />
      <div className="mt-8 grid grid-cols-1 gap-12 md:grid-cols-2">
        {sections.map((s) => {
          const { key, ...rest } = s;
          return <MoveSection key={key} mode={mode} {...rest} />;
        })}
      </div>
    </>
  );
}

function RankToggle({
  mode,
  onChange,
}: {
  mode: RankMode;
  onChange: (m: RankMode) => void;
}) {
  return (
    <div className="mt-12 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
      <span>Rank by</span>
      <div className="inline-flex overflow-hidden rounded border border-hairline">
        <button
          type="button"
          onClick={() => onChange("dollar")}
          className={cn(
            "px-3 py-1 transition-colors",
            mode === "dollar"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          Dollars
        </button>
        <button
          type="button"
          onClick={() => onChange("weight")}
          className={cn(
            "border-l border-hairline px-3 py-1 transition-colors",
            mode === "weight"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          % of portfolio
        </button>
      </div>
    </div>
  );
}

function MoveSection({
  title,
  subtitle,
  moves,
  tone,
  valueOf,
  valueOfPct,
  mode,
}: Omit<Section, "key"> & { mode: RankMode }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("");

  // Pick the comparator and the per-row magnitude based on rank mode. Re-sort
  // moves in-place (immutably) so the order matches whichever value is shown.
  const ranker = mode === "dollar" ? valueOf : valueOfPct;

  const ranked = useMemo(() => {
    return [...moves].sort((a, b) => ranker(b) - ranker(a));
  }, [moves, ranker]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return ranked;
    return ranked.filter(
      (m) =>
        m.issuer.toLowerCase().includes(f) ||
        m.fundName.toLowerCase().includes(f) ||
        m.cusip.toLowerCase().includes(f),
    );
  }, [ranked, filter]);

  const visible = expanded ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hasMore = filtered.length > DEFAULT_VISIBLE;

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <div>
          <h3 className="font-serif text-xl text-foreground">{title}</h3>
          <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
            {subtitle}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted">
            count
          </div>
          <div className="font-mono text-sm tabular text-foreground">
            {filtered.length.toLocaleString()}
            {filtered.length !== moves.length ? (
              <span className="text-muted"> / {moves.length.toLocaleString()}</span>
            ) : null}
          </div>
        </div>
      </div>

      {moves.length > DEFAULT_VISIBLE && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by ticker, fund, or CUSIP…"
          className="mt-3 w-full border-b border-hairline bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
          spellCheck={false}
        />
      )}

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No matches.</p>
      ) : (
        <ul className="mt-1 divide-y divide-hairline/60">
          {visible.map((m, i) => (
            <li key={`${m.fundCik}-${m.cusip}-${m.titleOfClass}-${m.putCall ?? ""}-${i}`}>
              <Link
                href={`/fund/${m.fundCik}/${m.filingAccession}`}
                className="group block py-3 transition-colors hover:bg-subtle/40"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-base leading-tight text-foreground transition-colors group-hover:text-accent">
                      {m.issuer}
                      {m.putCall ? (
                        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                          {m.putCall}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      <span>{m.fundName}</span>
                      <span className="mx-1.5">·</span>
                      <span>{m.quarter}</span>
                      <span className="mx-1.5">·</span>
                      <span className="font-mono">{m.cusip}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn(
                        "tabular text-sm",
                        tone === "positive" ? "text-positive" : "text-negative",
                      )}
                    >
                      {tone === "positive" ? "+" : "−"}
                      {mode === "dollar"
                        ? formatUSD(valueOf(m), { compact: true })
                        : `${formatPct(valueOfPct(m), 2)} pts`}
                    </div>
                    <div className="mt-0.5 text-xs text-muted tabular">
                      {m.type === "new" && "NEW"}
                      {m.type === "exited" && "EXITED"}
                      {(m.type === "added" || m.type === "trimmed") &&
                        m.deltaSharesPct != null &&
                        `${m.deltaSharesPct > 0 ? "+" : ""}${formatPct(m.deltaSharesPct, 0)}`}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 text-xs uppercase tracking-widest text-accent transition-opacity hover:opacity-70"
        >
          {expanded
            ? `↑ Show top ${DEFAULT_VISIBLE}`
            : `↓ Show all ${filtered.length.toLocaleString()}`}
        </button>
      )}
    </section>
  );
}
