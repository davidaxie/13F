"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Move } from "@/lib/dashboard";
import {
  FUND_STYLE_LABELS,
  MARQUEE_FUNDS,
  type FundStyle,
} from "@/lib/funds";
import { GICS_SECTORS, getSectorByCusip } from "@/lib/refdata";
import { downloadCSV, slugify, toCSV, type CsvColumn } from "@/lib/csv";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

// A move with its CUSIP resolved to a ticker (done on the server in
// cross-fund-highlights.tsx). Rows lead with the ticker as the primary
// identifier; the underlying company name is intentionally not shown.
export type MoveWithTicker = Move & { ticker: string | null };

// CIK → style lookup (computed once at module load).
const STYLE_BY_CIK = new Map<string, FundStyle>(
  MARQUEE_FUNDS.map((f) => [f.cik, f.style]),
);
const ALL_STYLES: FundStyle[] = ["value", "activist", "tigerCub", "quant", "macro"];

// Fund counts per style (for chip labels and disabled state).
const STYLE_FUND_COUNTS: Record<FundStyle, number> = (() => {
  const counts: Record<FundStyle, number> = {
    value: 0,
    activist: 0,
    tigerCub: 0,
    quant: 0,
    macro: 0,
  };
  for (const f of MARQUEE_FUNDS) counts[f.style]++;
  return counts;
})();

const DEFAULT_VISIBLE = 12;

type RankMode = "dollar" | "weight";

type Section = {
  key: string;
  title: string;
  subtitle: string;
  moves: MoveWithTicker[];
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
  newLong: MoveWithTicker[];
  shortOpens: MoveWithTicker[];
  callOpens: MoveWithTicker[];
  exits: MoveWithTicker[];
  adds: MoveWithTicker[];
  trims: MoveWithTicker[];
}) {
  const [mode, setMode] = useState<RankMode>("dollar");
  const [selectedCohorts, setSelectedCohorts] = useState<Set<FundStyle>>(
    () => new Set(ALL_STYLES),
  );
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(
    () => new Set(GICS_SECTORS),
  );

  function toggleCohort(s: FundStyle) {
    setSelectedCohorts((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      // Never end up with an empty set — treat empty as "all selected" so the
      // dashboard never appears mysteriously blank.
      if (next.size === 0) return new Set(ALL_STYLES);
      return next;
    });
  }
  function selectAllCohorts() {
    setSelectedCohorts(new Set(ALL_STYLES));
  }
  function toggleSector(s: string) {
    setSelectedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      if (next.size === 0) return new Set(GICS_SECTORS);
      return next;
    });
  }
  function selectAllSectors() {
    setSelectedSectors(new Set(GICS_SECTORS));
  }

  // Apply cohort + sector filters once across all six sections so they share a
  // coherent subset. Collapsed into a single useMemo so the dep array is exact.
  const { newLongF, exitsF, addsF, trimsF, shortOpensF, callOpensF } = useMemo(
    () => {
      const allCohortsSelected = selectedCohorts.size === ALL_STYLES.length;
      const allSectorsSelected = selectedSectors.size === GICS_SECTORS.length;
      const ok = (m: Move): boolean => {
        if (!allCohortsSelected) {
          const s = STYLE_BY_CIK.get(m.fundCik);
          if (!s || !selectedCohorts.has(s)) return false;
        }
        if (!allSectorsSelected) {
          const sec = getSectorByCusip(m.cusip)?.sector;
          // Untagged names (small-caps, ADRs) are kept only when ALL sectors
          // are selected — once the user filters, untagged means "exclude."
          if (!sec || !selectedSectors.has(sec)) return false;
        }
        return true;
      };
      return {
        newLongF: newLong.filter(ok),
        exitsF: exits.filter(ok),
        addsF: adds.filter(ok),
        trimsF: trims.filter(ok),
        shortOpensF: shortOpens.filter(ok),
        callOpensF: callOpens.filter(ok),
      };
    },
    [
      newLong,
      exits,
      adds,
      trims,
      shortOpens,
      callOpens,
      selectedCohorts,
      selectedSectors,
    ],
  );

  const deltaWeight = (m: Move) =>
    Math.abs(m.weightInPortfolio - (m.prevWeightInPortfolio ?? 0));

  const sections: Section[] = [
    {
      key: "newLong",
      title: "New long positions",
      subtitle: "Opened this quarter · common stock",
      moves: newLongF,
      tone: "positive",
      valueOf: (m) => m.currentValueUsd,
      valueOfPct: (m) => m.weightInPortfolio,
    },
    {
      key: "exits",
      title: "Exits",
      subtitle: "Fully sold out · common stock",
      moves: exitsF,
      tone: "negative",
      valueOf: (m) => m.prevValueUsd,
      // For exits, weightInPortfolio already reflects the prev (pre-exit)
      // weight (see dashboard.ts).
      valueOfPct: (m) => m.weightInPortfolio,
    },
    {
      key: "shortOpens",
      title: "Short bets opened",
      // 13F reports puts as notional ($ underlying), NOT delta-adjusted
      // exposure — a $100M put position isn't $100M of directional risk if
      // it's deep OTM or hedging an existing long. Treat as a directional
      // hint, not a position size.
      subtitle: "New put positions · notional, may be hedges",
      moves: shortOpensF,
      tone: "negative",
      valueOf: (m) => m.currentValueUsd,
      valueOfPct: (m) => m.weightInPortfolio,
    },
    {
      key: "callOpens",
      title: "Call options opened",
      // Same notional caveat. Calls can be cash-secured income trades, not
      // pure directional bullish bets.
      subtitle: "New call positions · notional, may be income trades",
      moves: callOpensF,
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
      moves: addsF,
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
      moves: trimsF,
      tone: "negative",
      valueOf: (m) => Math.abs(m.deltaUsd),
      valueOfPct: deltaWeight,
    },
  ];

  return (
    <>
      <CohortFilter
        selected={selectedCohorts}
        onToggle={toggleCohort}
        onSelectAll={selectAllCohorts}
      />
      <SectorFilter
        selected={selectedSectors}
        onToggle={toggleSector}
        onSelectAll={selectAllSectors}
      />
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

function SectorFilter({
  selected,
  onToggle,
  onSelectAll,
}: {
  selected: Set<string>;
  onToggle: (s: string) => void;
  onSelectAll: () => void;
}) {
  const all = selected.size === GICS_SECTORS.length;
  // Short labels for the chip strip — GICS sector names are long. Map only
  // those that would otherwise wrap or overflow.
  const SHORT: Record<string, string> = {
    "Communication Services": "Comm Svcs",
    "Consumer Discretionary": "Cons Disc",
    "Consumer Staples": "Cons Stpl",
    "Information Technology": "Info Tech",
    "Health Care": "Healthcare",
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs uppercase tracking-widest text-muted">
      <span>Sector</span>
      <button
        type="button"
        onClick={onSelectAll}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
          all
            ? "border-foreground bg-foreground text-background"
            : "border-hairline text-muted hover:border-foreground hover:text-foreground",
        )}
      >
        All
      </button>
      {GICS_SECTORS.map((s) => {
        const active = !all && selected.has(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            title={s}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-hairline text-muted hover:border-foreground hover:text-foreground",
            )}
          >
            {SHORT[s] ?? s}
          </button>
        );
      })}
    </div>
  );
}

function CohortFilter({
  selected,
  onToggle,
  onSelectAll,
}: {
  selected: Set<FundStyle>;
  onToggle: (s: FundStyle) => void;
  onSelectAll: () => void;
}) {
  const all = selected.size === ALL_STYLES.length;
  return (
    <div className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs uppercase tracking-widest text-muted">
      <span>Cohort</span>
      <button
        type="button"
        onClick={onSelectAll}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
          all
            ? "border-foreground bg-foreground text-background"
            : "border-hairline text-muted hover:border-foreground hover:text-foreground",
        )}
      >
        All
        <span className="font-mono tabular text-[10px] opacity-70">
          {MARQUEE_FUNDS.length}
        </span>
      </button>
      {ALL_STYLES.map((s) => {
        const active = !all && selected.has(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-hairline text-muted hover:border-foreground hover:text-foreground",
            )}
          >
            {FUND_STYLE_LABELS[s]}
            <span className="font-mono tabular text-[10px] opacity-70">
              {STYLE_FUND_COUNTS[s]}
            </span>
          </button>
        );
      })}
    </div>
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
    <div
      className="mt-12 flex items-center gap-3 text-xs uppercase tracking-widest text-muted"
      role="group"
      aria-label="Rank moves by dollar value or by percent of portfolio"
    >
      <span>Rank by</span>
      <div className="inline-flex overflow-hidden rounded border border-hairline">
        <button
          type="button"
          onClick={() => onChange("dollar")}
          aria-pressed={mode === "dollar"}
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
          aria-pressed={mode === "weight"}
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
        (m.ticker?.toLowerCase().includes(f) ?? false) ||
        m.issuer.toLowerCase().includes(f) ||
        m.fundName.toLowerCase().includes(f) ||
        m.cusip.toLowerCase().includes(f),
    );
  }, [ranked, filter]);

  const visible = expanded ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hasMore = filtered.length > DEFAULT_VISIBLE;

  function handleExport() {
    const cols: CsvColumn<Move>[] = [
      { label: "Fund", get: (m) => m.fundName },
      { label: "Fund CIK", get: (m) => m.fundCik },
      { label: "Quarter", get: (m) => m.quarter },
      { label: "Filing Accession", get: (m) => m.filingAccession },
      { label: "Issuer", get: (m) => m.issuer },
      { label: "CUSIP", get: (m) => m.cusip },
      { label: "Title of Class", get: (m) => m.titleOfClass },
      { label: "Put/Call", get: (m) => m.putCall ?? "" },
      { label: "Move Type", get: (m) => m.type },
      { label: "Current Value USD", get: (m) => m.currentValueUsd.toFixed(0) },
      { label: "Prev Value USD", get: (m) => m.prevValueUsd.toFixed(0) },
      { label: "Δ Value USD", get: (m) => m.deltaUsd.toFixed(0) },
      {
        label: "Δ Shares %",
        get: (m) =>
          m.deltaSharesPct != null ? m.deltaSharesPct.toFixed(4) : "",
      },
      {
        label: "Weight % (current or pre-exit)",
        get: (m) => m.weightInPortfolio.toFixed(4),
      },
      {
        label: "Prev Weight %",
        get: (m) =>
          m.prevWeightInPortfolio != null
            ? m.prevWeightInPortfolio.toFixed(4)
            : "",
      },
    ];
    const csv = toCSV(filtered, cols);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`13f-moves-${slugify(title)}-${stamp}.csv`, csv);
  }

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <div>
          <h3 className="font-serif text-xl text-foreground">{title}</h3>
          <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
            {subtitle}
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 border-b border-hairline pb-1 text-[10px] uppercase tracking-widest text-muted transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-muted"
            title={
              filter.trim()
                ? `Export ${filtered.length} filtered rows`
                : `Export all ${moves.length} rows`
            }
          >
            <Download size={11} strokeWidth={1.5} />
            CSV
          </button>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">
              count
            </div>
            <div className="font-mono text-sm tabular text-foreground">
              {filtered.length.toLocaleString()}
              {filtered.length !== moves.length ? (
                <span className="text-muted">
                  {" "}
                  / {moves.length.toLocaleString()}
                </span>
              ) : null}
            </div>
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
                    <div className="truncate leading-tight">
                      {m.ticker ? (
                        <span className="font-mono text-base font-medium text-foreground transition-colors group-hover:text-accent">
                          {m.ticker}
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-muted">
                          {m.cusip}
                        </span>
                      )}
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
