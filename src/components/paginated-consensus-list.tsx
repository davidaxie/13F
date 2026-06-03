"use client";

import Link from "next/link";
import { useState } from "react";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Client-side pagination for the long lists on /consensus. The page is
 * `force-static` and computes every row at build time; this component
 * just controls how many of those pre-computed rows the DOM materializes.
 * Default 30 visible, Show-more reveals 30 at a time. Keeps the initial
 * scroll length manageable without losing access to the long tail.
 */
const STEP = 30;

export type Tone = "positive" | "negative" | "neutral";

export type RowActivity =
  | { kind: "single"; text: string }
  | { kind: "split"; newText: string; exitedText: string };

export type ConsensusRow = {
  cusip: string;
  ticker: string | null;
  issuer: string;
  totalEntryValueUsd: number;
  metric: { label: string; tone: Tone };
  activity: RowActivity;
};

export function PaginatedConsensusList({
  rows,
  initialVisible = STEP,
  emptyText,
}: {
  rows: ConsensusRow[];
  /** Number of rows visible on mount. Pass `rows.length` to disable
   * the Show-more button (used for sections we don't want to paginate). */
  initialVisible?: number;
  emptyText: string;
}) {
  const [visible, setVisible] = useState(initialVisible);

  if (rows.length === 0) {
    return <p className="mt-6 text-sm text-muted">{emptyText}</p>;
  }

  const shown = rows.slice(0, visible);
  const remaining = rows.length - visible;

  return (
    <>
      <ul className="mt-2 divide-y divide-hairline/60">
        {shown.map((r) => (
          <li key={r.cusip}>
            <div className="group block py-4 transition-colors hover:bg-subtle/40">
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    {r.ticker ? (
                      <Link
                        href={`/stock/${r.ticker}`}
                        className="font-mono text-base font-medium text-foreground transition-colors hover:text-accent"
                      >
                        {r.ticker}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-muted">
                        {r.cusip}
                      </span>
                    )}
                    <span className="truncate font-serif text-base text-foreground/85">
                      {r.issuer}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {r.activity.kind === "split" ? (
                      <>
                        <span className="text-positive">
                          ↑ {r.activity.newText}
                        </span>
                        <span className="mx-2">·</span>
                        <span className="text-negative">
                          ↓ {r.activity.exitedText}
                        </span>
                      </>
                    ) : (
                      <span>{r.activity.text}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      "tabular text-sm",
                      r.metric.tone === "positive" && "text-positive",
                      r.metric.tone === "negative" && "text-negative",
                      r.metric.tone === "neutral" && "text-foreground",
                    )}
                  >
                    {r.metric.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted tabular">
                    {formatUSD(r.totalEntryValueUsd, { compact: true })} at
                    entry
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="mt-6 flex items-center justify-center">
          <button
            type="button"
            onClick={() =>
              setVisible((v) => Math.min(v + STEP, rows.length))
            }
            className="rounded border border-hairline px-4 py-2 text-xs uppercase tracking-widest text-muted transition-colors hover:border-foreground hover:text-foreground"
          >
            Show {Math.min(STEP, remaining)} more ·{" "}
            {remaining.toLocaleString()} remaining
          </button>
        </div>
      )}
    </>
  );
}
