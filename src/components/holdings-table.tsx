"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { formatInt, formatPct, formatUSD } from "@/lib/format";
import { downloadCSV, slugify, toCSV, type CsvColumn } from "@/lib/csv";
import { cn } from "@/lib/utils";

export type Row = {
  issuer: string;
  titleOfClass: string;
  cusip: string;
  ticker: string | null;
  valueUsd: number;
  shares: number;
  putCall?: string;
  pctOfPortfolio: number;
  prevValueUsd: number | null;
  prevShares: number | null;
  changeType: "new" | "exited" | "increased" | "decreased" | "unchanged";
  shareChangePct: number | null;
};

type SortKey = "value" | "issuer" | "shares" | "pct" | "change";
type SortDir = "asc" | "desc";
type ChangeFilter = "all" | "new" | "increased" | "decreased" | "unchanged";

export function HoldingsTable({
  rows,
  totalValueUsd,
  exportContext,
}: {
  rows: Row[];
  totalValueUsd: number;
  exportContext?: { fundName: string; quarter: string };
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>("all");

  // Counts per change-type so the chip labels show the available subset sizes.
  const counts = useMemo(() => {
    const c: Record<ChangeFilter, number> = {
      all: rows.length,
      new: 0,
      increased: 0,
      decreased: 0,
      unchanged: 0,
    };
    for (const r of rows) {
      if (r.changeType === "new") c.new++;
      else if (r.changeType === "increased") c.increased++;
      else if (r.changeType === "decreased") c.decreased++;
      else if (r.changeType === "unchanged") c.unchanged++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const textFiltered = f
      ? rows.filter(
          (r) =>
            r.issuer.toLowerCase().includes(f) ||
            r.cusip.toLowerCase().includes(f),
        )
      : rows;

    const typeFiltered =
      changeFilter === "all"
        ? textFiltered
        : textFiltered.filter((r) => r.changeType === changeFilter);

    const dir = sortDir === "asc" ? 1 : -1;
    return [...typeFiltered].sort((a, b) => {
      switch (sortKey) {
        case "issuer":
          return a.issuer.localeCompare(b.issuer) * dir;
        case "shares":
          return (a.shares - b.shares) * dir;
        case "pct":
          return (a.pctOfPortfolio - b.pctOfPortfolio) * dir;
        case "change": {
          const av = a.shareChangePct ?? -Infinity;
          const bv = b.shareChangePct ?? -Infinity;
          return (av - bv) * dir;
        }
        case "value":
        default:
          return (a.valueUsd - b.valueUsd) * dir;
      }
    });
  }, [rows, filter, sortKey, sortDir, changeFilter]);

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "issuer" ? "asc" : "desc");
    }
  }

  const matches = filtered.length;

  function handleExport() {
    const cols: CsvColumn<Row>[] = [
      { label: "Rank", get: (_r) => filtered.indexOf(_r) + 1 },
      { label: "Issuer", get: (r) => r.issuer },
      { label: "Ticker", get: (r) => r.ticker ?? "" },
      { label: "CUSIP", get: (r) => r.cusip },
      { label: "Class", get: (r) => r.titleOfClass },
      { label: "Put/Call", get: (r) => r.putCall ?? "" },
      { label: "Value USD", get: (r) => r.valueUsd.toFixed(0) },
      { label: "% Portfolio", get: (r) => r.pctOfPortfolio.toFixed(4) },
      { label: "Shares", get: (r) => r.shares },
      { label: "Prev Value USD", get: (r) => r.prevValueUsd ?? "" },
      { label: "Prev Shares", get: (r) => r.prevShares ?? "" },
      { label: "Change", get: (r) => r.changeType },
      {
        label: "Share Change %",
        get: (r) =>
          r.shareChangePct != null ? r.shareChangePct.toFixed(4) : "",
      },
    ];
    const csv = toCSV(filtered, cols);
    const base = exportContext
      ? `13f-${slugify(exportContext.fundName)}-${slugify(exportContext.quarter)}`
      : `13f-holdings-${new Date().toISOString().slice(0, 10)}`;
    downloadCSV(`${base}.csv`, csv);
  }

  const chips: Array<{ key: ChangeFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "new", label: "New", count: counts.new },
    { key: "increased", label: "Increased", count: counts.increased },
    { key: "decreased", label: "Decreased", count: counts.decreased },
    { key: "unchanged", label: "Unchanged", count: counts.unchanged },
  ];

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl text-foreground">
          Holdings <span className="text-muted">· {rows.length}</span>
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by issuer or CUSIP…"
            className="w-64 max-w-full border-b border-hairline bg-transparent py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 border-b border-hairline pb-1 text-xs uppercase tracking-widest text-muted transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-muted"
            title={
              filter.trim() || changeFilter !== "all"
                ? `Export ${filtered.length} filtered rows`
                : `Export all ${rows.length} rows`
            }
          >
            <Download size={12} strokeWidth={1.5} />
            CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChangeFilter(c.key)}
            disabled={c.count === 0 && c.key !== "all"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition-colors",
              changeFilter === c.key
                ? "border-foreground bg-foreground text-background"
                : "border-hairline text-muted hover:border-foreground hover:text-foreground",
              c.count === 0 && c.key !== "all" && "opacity-40 hover:border-hairline hover:text-muted",
            )}
          >
            <span>{c.label}</span>
            <span className="font-mono tabular text-[10px] opacity-70">
              {c.count.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-3 pr-3 font-normal">#</th>
              <SortHeader
                label="Issuer"
                k="issuer"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggle}
                align="left"
              />
              <th className="py-3 px-3 font-normal">Class</th>
              <SortHeader
                label="Value"
                k="value"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggle}
                align="right"
              />
              <SortHeader
                label="% Port"
                k="pct"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggle}
                align="right"
              />
              <SortHeader
                label="Shares"
                k="shares"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggle}
                align="right"
              />
              <SortHeader
                label="Δ Shares"
                k="change"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggle}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.cusip}-${r.titleOfClass}-${i}`}
                className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
              >
                <td className="py-3 pr-3 text-xs text-muted tabular">
                  {i + 1}
                </td>
                <td className="py-3 pr-3 text-foreground">
                  {r.ticker ? (
                    <Link
                      href={`/stock/${r.ticker}`}
                      className="font-serif text-base leading-tight transition-colors hover:text-accent"
                    >
                      {r.issuer}
                    </Link>
                  ) : (
                    <div className="font-serif text-base leading-tight">
                      {r.issuer}
                    </div>
                  )}
                  <div className="mt-0.5 font-mono text-xs text-muted">
                    {r.ticker ? `${r.ticker} · ` : ""}
                    {r.cusip}
                    {r.putCall ? ` · ${r.putCall}` : ""}
                  </div>
                </td>
                <td className="py-3 px-3 text-xs text-muted">
                  {r.titleOfClass}
                </td>
                <td className="py-3 px-3 text-right tabular text-foreground">
                  {formatUSD(r.valueUsd, { compact: true })}
                </td>
                <td className="py-3 px-3 text-right tabular text-muted">
                  {formatPct(r.pctOfPortfolio, 2)}
                </td>
                <td className="py-3 px-3 text-right tabular text-muted">
                  {formatInt(r.shares)}
                </td>
                <td className="py-3 pl-3 text-right">
                  <ChangeBadge row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matches === 0 && (
        <p className="mt-6 text-sm text-muted">No matches.</p>
      )}

      <div className="mt-6 flex justify-end text-xs text-muted">
        <span>
          Total filing value:{" "}
          <span className="tabular text-foreground">
            {formatUSD(totalValueUsd, { compact: true })}
          </span>
        </span>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th
      className={cn(
        "py-3 px-3 font-normal",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        <span>{label}</span>
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp size={12} strokeWidth={1.5} />
          ) : (
            <ArrowDown size={12} strokeWidth={1.5} />
          )
        ) : (
          <ArrowUpDown size={12} strokeWidth={1.5} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

function ChangeBadge({ row }: { row: Row }) {
  if (row.changeType === "new") {
    return (
      <span className="font-mono text-xs uppercase tracking-wider text-positive">
        New
      </span>
    );
  }
  if (row.changeType === "unchanged") {
    return <span className="font-mono text-xs text-muted">—</span>;
  }
  if (row.shareChangePct == null) {
    return <span className="font-mono text-xs text-muted">—</span>;
  }
  const positive = row.shareChangePct > 0;
  return (
    <span
      className={cn(
        "tabular font-mono text-xs",
        positive ? "text-positive" : "text-negative",
      )}
    >
      {positive ? "+" : ""}
      {formatPct(row.shareChangePct, 1)}
    </span>
  );
}
