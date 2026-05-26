"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatInt, formatPct, formatUSD } from "@/lib/format";
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

export function HoldingsTable({
  rows,
  totalValueUsd,
}: {
  rows: Row[];
  totalValueUsd: number;
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const base = f
      ? rows.filter(
          (r) =>
            r.issuer.toLowerCase().includes(f) ||
            r.cusip.toLowerCase().includes(f),
        )
      : rows;

    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
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
  }, [rows, filter, sortKey, sortDir]);

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "issuer" ? "asc" : "desc");
    }
  }

  const matches = filtered.length;

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl text-foreground">
          Holdings <span className="text-muted">· {rows.length}</span>
        </h2>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by issuer or CUSIP…"
          className="w-64 max-w-full border-b border-hairline bg-transparent py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
          spellCheck={false}
        />
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
