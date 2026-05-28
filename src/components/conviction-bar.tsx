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

// Conviction = the new position's weight in the opening fund's 13F book. The
// bar clamps weight to a 0–10% scale, so a 10%+ position fills it and a 0.1%
// quant flicker barely registers — the visual makes the signal-vs-noise point.
export function ConvictionBar({ entryKey }: { entryKey: string }) {
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

  const convictionPct = Math.min(100, Math.max(0, weight * 10));
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
