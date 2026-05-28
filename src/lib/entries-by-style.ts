import { cache } from "react";
import type { BacktestTrade, FundBacktest } from "./backtest";
import { getAllFundDiffs } from "./dashboard";
import {
  MARQUEE_FUNDS,
  SIGNAL_TIER_META,
  STYLE_SIGNAL_TIER,
  type FundStyle,
  type SignalTier,
} from "./funds";
import { getSnapshot } from "./snapshots";

// A single new position, tagged with the opening fund's style so the page can
// group entries by investing style and rank styles by signal quality. Built
// from the committed snapshots (sync) so the page renders instantly — the
// per-position conviction weight needs the live portfolio totals and streams
// in separately (see getEntryWeights + /api/entry-weights).
export type StyleEntry = {
  fundCik: string;
  fundName: string;
  issuer: string;
  cusip: string;
  ticker: string | null;
  entryValueUsd: number;
};

export type StyleGroup = {
  style: FundStyle;
  tier: SignalTier;
  // Biggest entries first (by entry dollar value).
  entries: StyleEntry[];
  totalEntryValueUsd: number;
  fundCount: number; // distinct funds in this style that opened a position
  entryCount: number;
};

// Stable key joining a fund + security, used to look a conviction weight up
// from the streamed weight map.
export function entryWeightKey(fundCik: string, cusip: string): string {
  return `${fundCik}:${cusip}`;
}

// Per-fund "latest activity date" — proxy for the fund's most recent filing.
function latestActivityDate(snap: FundBacktest): string {
  let max = "";
  for (const t of snap.trades) {
    if (t.entryDate > max) max = t.entryDate;
    if (t.exitDate && t.exitDate > max) max = t.exitDate;
  }
  return max;
}

// INSTANT path: snapshot-backed and fully synchronous, so the page renders
// with no live SEC fetch. A position counts as "new this quarter" when its
// latest trade lifecycle opened on the fund's most-recent filing date. Carries
// no weight — that's the deferred, live part (getEntryWeights).
export const getEntriesByStyleFast = cache((): StyleGroup[] => {
  const byStyle = new Map<FundStyle, StyleEntry[]>();

  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) continue;
    const latest = latestActivityDate(snap);
    if (!latest) continue;

    // Keep only the latest trade lifecycle per CUSIP.
    const latestTradeByCusip = new Map<string, BacktestTrade>();
    for (const t of snap.trades) {
      const cur = latestTradeByCusip.get(t.cusip);
      if (!cur || t.entryDate > cur.entryDate) latestTradeByCusip.set(t.cusip, t);
    }

    for (const t of latestTradeByCusip.values()) {
      if (t.status !== "open" || t.entryDate !== latest) continue;
      const entry: StyleEntry = {
        fundCik: fund.cik,
        fundName: fund.displayName,
        issuer: t.issuer,
        cusip: t.cusip,
        ticker: t.ticker,
        entryValueUsd: t.entryValueUsd,
      };
      const list = byStyle.get(fund.style);
      if (list) list.push(entry);
      else byStyle.set(fund.style, [entry]);
    }
  }

  const groups: StyleGroup[] = [];
  for (const [style, entries] of byStyle) {
    entries.sort((a, b) => b.entryValueUsd - a.entryValueUsd);
    const fundCount = new Set(entries.map((e) => e.fundCik)).size;
    groups.push({
      style,
      tier: STYLE_SIGNAL_TIER[style],
      entries,
      totalEntryValueUsd: entries.reduce((s, e) => s + e.entryValueUsd, 0),
      fundCount,
      entryCount: entries.length,
    });
  }

  // High-conviction tiers first (value/activist), mechanical quant flow last;
  // ties broken by capital deployed.
  groups.sort(
    (a, b) =>
      SIGNAL_TIER_META[a.tier].rank - SIGNAL_TIER_META[b.tier].rank ||
      b.totalEntryValueUsd - a.totalEntryValueUsd,
  );

  return groups;
});

// DEFERRED path: each new common-stock position's weight in its fund's 13F
// book. Needs the live diffs (the snapshot doesn't store portfolio totals), so
// it's slow — served from /api/entry-weights and fetched after first paint.
// Keyed by entryWeightKey(fundCik, cusip).
export const getEntryWeights = cache(
  async (): Promise<Record<string, number>> => {
    const diffs = await getAllFundDiffs();
    const weights: Record<string, number> = {};
    for (const diff of diffs) {
      for (const m of diff.moves) {
        if (m.type !== "new" || m.putCall) continue;
        weights[entryWeightKey(m.fundCik, m.cusip)] = m.weightInPortfolio;
      }
    }
    return weights;
  },
);
