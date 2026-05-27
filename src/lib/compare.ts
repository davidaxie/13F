import { cache } from "react";
import { MARQUEE_FUNDS, type MarqueeFund } from "./funds";
import { getSnapshot } from "./snapshots";
import { tickerForCusip } from "./stock-view";
import type { BacktestTrade } from "./backtest";

export type Position = {
  cusip: string;
  ticker: string | null;
  issuer: string;
  // Snapshot-captured at trade open (frozen; see stock-view caveats).
  sharesAtOpen: number;
  entryDate: string;
  entryValueUsd: number;
  priceReturnPct: number | null;  // (latestPrice − entry) / entry, when both known
  latestPrice: number | null;
};

export type CompareView = {
  fundA: MarqueeFund;
  fundB: MarqueeFund;
  overlap: Array<{
    position: Position;     // canonical (uses fund A's record for issuer name)
    aValueUsd: number;
    bValueUsd: number;
    combinedValueUsd: number;
  }>;
  onlyA: Position[];
  onlyB: Position[];
  // Summary stats
  overlapCount: number;
  onlyACount: number;
  onlyBCount: number;
  combinedOverlapValueUsd: number;
};

// Pull a fund's current holdings (open trades only) from its snapshot.
function currentHoldings(cik: string): Map<string, Position> {
  const snap = getSnapshot(cik);
  if (!snap) return new Map();

  // Per-CUSIP: take the latest trade. Snapshot trades may include a closed
  // lifecycle followed by a new open one (re-entry); keep only the latest.
  const latestByCusip = new Map<string, BacktestTrade>();
  for (const t of snap.trades) {
    const cur = latestByCusip.get(t.cusip);
    if (!cur || t.entryDate > cur.entryDate) {
      latestByCusip.set(t.cusip, t);
    }
  }

  const out = new Map<string, Position>();
  for (const [cusip, t] of latestByCusip) {
    if (t.status !== "open") continue;
    const latestPrice: number | null = t.ticker
      ? (snap.latestPriceByTicker[t.ticker] ?? null)
      : null;
    const priceReturnPct =
      latestPrice != null && t.entrySharePrice > 0
        ? (latestPrice / t.entrySharePrice - 1) * 100
        : null;
    out.set(cusip, {
      cusip,
      ticker: t.ticker ?? tickerForCusip(cusip),
      issuer: t.issuer,
      sharesAtOpen: t.shares,
      entryDate: t.entryDate,
      entryValueUsd: t.entryValueUsd,
      priceReturnPct,
      latestPrice,
    });
  }
  return out;
}

function fundOrThrow(cik: string): MarqueeFund {
  const f = MARQUEE_FUNDS.find((x) => x.cik === cik);
  if (!f) throw new Error(`Unknown marquee fund CIK: ${cik}`);
  return f;
}

export const computeCompare = cache(
  (cikA: string, cikB: string): CompareView => {
    const fundA = fundOrThrow(cikA);
    const fundB = fundOrThrow(cikB);
    const a = currentHoldings(cikA);
    const b = currentHoldings(cikB);

    const overlap: CompareView["overlap"] = [];
    const onlyA: Position[] = [];
    const onlyB: Position[] = [];

    for (const [cusip, pa] of a) {
      const pb = b.get(cusip);
      if (pb) {
        // Prefer the longer issuer string — usually the more complete name.
        const canonical = pa.issuer.length >= pb.issuer.length ? pa : pb;
        overlap.push({
          position: canonical,
          aValueUsd: pa.entryValueUsd,
          bValueUsd: pb.entryValueUsd,
          combinedValueUsd: pa.entryValueUsd + pb.entryValueUsd,
        });
      } else {
        onlyA.push(pa);
      }
    }
    for (const [cusip, pb] of b) {
      if (!a.has(cusip)) onlyB.push(pb);
    }

    overlap.sort((x, y) => y.combinedValueUsd - x.combinedValueUsd);
    onlyA.sort((x, y) => y.entryValueUsd - x.entryValueUsd);
    onlyB.sort((x, y) => y.entryValueUsd - x.entryValueUsd);

    const combinedOverlapValueUsd = overlap.reduce(
      (s, r) => s + r.combinedValueUsd,
      0,
    );

    return {
      fundA,
      fundB,
      overlap,
      onlyA,
      onlyB,
      overlapCount: overlap.length,
      onlyACount: onlyA.length,
      onlyBCount: onlyB.length,
      combinedOverlapValueUsd,
    };
  },
);
