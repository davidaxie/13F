"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { formatPct } from "@/lib/format";

type WeightsState = {
  status: "loading" | "ready" | "error";
  weights: Record<string, number>;
};

const WeightsContext = createContext<WeightsState>({
  status: "loading",
  weights: {},
});

// Wraps the (server-rendered) entries board. Fetches the conviction weights
// once after mount from /api/entry-weights and shares them via context, so the
// page paints instantly from snapshots and the bars fill in a moment later.
export function ConvictionWeightsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WeightsState>({
    status: "loading",
    weights: {},
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/entry-weights");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { weights?: Record<string, number> } = await res.json();
        if (!ignore) {
          setState({ status: "ready", weights: data.weights ?? {} });
        }
      } catch {
        if (!ignore) setState({ status: "error", weights: {} });
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <WeightsContext.Provider value={state}>{children}</WeightsContext.Provider>
  );
}

// Conviction = the new position's weight in the opening fund's 13F book.
//
// Raw weights are heavy-tailed inside a tier — Pershing's 15% MSFT next to a
// Renaissance 0.001% rounding stub — so a linear "weight × 10" clamp had every
// row outside the top sliver flatlining at 0. Instead, the bar's fill is the
// row's PERCENTILE within the tier's weight distribution. A row at the median
// is half-full; the largest in its tier fills it; the smallest gets a sliver.
// The percent text next to the bar still shows the raw weight so the absolute
// signal isn't lost — only the visual ranking is relative.
export function ConvictionBar({
  entryKey,
  tierEntryKeys,
}: {
  entryKey: string;
  /**
   * All entry keys in the same tier as this row. The bar derives the tier's
   * weight distribution from context at render-time so the percentile only
   * compares like with like (quant rows aren't ranked against activist rows).
   */
  tierEntryKeys: readonly string[];
}) {
  const { status, weights } = useContext(WeightsContext);

  if (status === "loading") {
    // Same footprint as the real bar — no layout shift when weights arrive.
    return (
      <div className="mt-1 flex items-center justify-end gap-2">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-hairline">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-muted/50" />
        </div>
        <span className="tabular text-xs text-muted/60">···</span>
      </div>
    );
  }

  const weight = weights[entryKey];
  if (weight == null) {
    // Errored, or no live match for this snapshot entry.
    return (
      <div className="mt-1 flex items-center justify-end gap-2">
        <span className="tabular text-xs text-muted/60">—</span>
      </div>
    );
  }

  // Percentile within the tier's weight distribution. Tier weights are sparse
  // (some entry keys won't have a live match) — only score against the ones
  // that did resolve. Tie-aware: a row's percentile is the share of peers it
  // is at-least-as-large-as, so the top of the tier always reaches 100%.
  const tierWeights: number[] = [];
  for (const k of tierEntryKeys) {
    const w = weights[k];
    if (w != null) tierWeights.push(w);
  }
  let convictionPct = 50;
  if (tierWeights.length > 1) {
    let leq = 0;
    for (const w of tierWeights) {
      if (w <= weight) leq++;
    }
    convictionPct = (leq / tierWeights.length) * 100;
  } else if (tierWeights.length === 1) {
    // Singleton tier — bar always full.
    convictionPct = 100;
  }
  return (
    <div className="mt-1 flex items-center justify-end gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-accent/70 transition-[width] duration-700 ease-out"
          style={{ width: `${convictionPct}%` }}
        />
      </div>
      <span className="tabular text-xs text-muted">{formatPct(weight, 1)}</span>
    </div>
  );
}
