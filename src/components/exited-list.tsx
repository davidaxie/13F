"use client";

import Link from "next/link";
import { useState } from "react";
import { formatUSD } from "@/lib/format";

const DEFAULT_VISIBLE = 12;

export type ExitedRow = {
  issuer: string;
  cusip: string;
  ticker: string | null;
  prevValueUsd: number;
};

export function ExitedList({ rows }: { rows: ExitedRow[] }) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE);
  const hasMore = rows.length > DEFAULT_VISIBLE;

  return (
    <>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {visible.map((r) => {
          const label = (
            <>
              <span className="text-foreground">{r.issuer}</span>{" "}
              <span className="tabular text-xs">
                ({formatUSD(r.prevValueUsd, { compact: true })})
              </span>
            </>
          );
          return (
            <li key={r.cusip} className="text-muted">
              {r.ticker ? (
                <Link
                  href={`/stock/${r.ticker}`}
                  className="transition-colors hover:text-foreground"
                  title={`${r.ticker} · ${r.cusip}`}
                >
                  {label}
                </Link>
              ) : (
                <span title={r.cusip}>{label}</span>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 text-xs uppercase tracking-widest text-accent transition-opacity hover:opacity-70"
        >
          {expanded
            ? `↑ Show top ${DEFAULT_VISIBLE}`
            : `↓ Show all ${rows.length.toLocaleString()} exits`}
        </button>
      )}
    </>
  );
}
