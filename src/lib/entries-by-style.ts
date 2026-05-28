import { cache } from "react";
import { tickerForCusip } from "./cusip-lookup";
import { getAllFundDiffs } from "./dashboard";
import {
  MARQUEE_FUNDS,
  SIGNAL_TIER_META,
  STYLE_SIGNAL_TIER,
  type FundStyle,
  type SignalTier,
} from "./funds";

// A single new position, tagged with the opening fund's style so the page can
// group entries by investing style and rank styles by signal quality. Built
// from the live fund diffs (type === "new"), common stock only — options
// opens are a different instrument and aren't comparable as "an entry".
export type StyleEntry = {
  fundCik: string;
  fundName: string;
  issuer: string;
  cusip: string;
  ticker: string | null;
  entryValueUsd: number;
  // The position's weight in the opening fund's portfolio. This is the
  // conviction dimension: a value fund putting 9% of its book into a new name
  // means something very different from a quant opening it at 0.02%.
  weightInPortfolio: number;
  quarter: string;
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

const cikToStyle = new Map<string, FundStyle>(
  MARQUEE_FUNDS.map((f) => [f.cik, f.style]),
);

// Groups every new common-stock position this quarter by the opening fund's
// investing style, then orders the groups by signal tier (high-conviction
// value/activist first, mechanical quant flow last). Within each group the
// biggest entries lead. Backed by the same live diffs the dashboard uses, so
// it carries weightInPortfolio (conviction) which the snapshot path lacks.
export const getEntriesByStyle = cache(async (): Promise<StyleGroup[]> => {
  const diffs = await getAllFundDiffs();

  const byStyle = new Map<FundStyle, StyleEntry[]>();

  for (const diff of diffs) {
    for (const m of diff.moves) {
      // Only genuine new positions in common stock.
      if (m.type !== "new" || m.putCall) continue;
      const style = cikToStyle.get(m.fundCik);
      if (!style) continue;

      const entry: StyleEntry = {
        fundCik: m.fundCik,
        fundName: m.fundName,
        issuer: m.issuer,
        cusip: m.cusip,
        ticker: tickerForCusip(m.cusip),
        entryValueUsd: m.currentValueUsd,
        weightInPortfolio: m.weightInPortfolio,
        quarter: m.quarter,
      };

      const list = byStyle.get(style);
      if (list) list.push(entry);
      else byStyle.set(style, [entry]);
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

  // Order by signal tier first (high → noise), then by capital deployed within
  // the tier so the most active style leads each band.
  groups.sort(
    (a, b) =>
      SIGNAL_TIER_META[a.tier].rank - SIGNAL_TIER_META[b.tier].rank ||
      b.totalEntryValueUsd - a.totalEntryValueUsd,
  );

  return groups;
});
