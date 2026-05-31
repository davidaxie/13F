import { cache } from "react";
import { MARQUEE_FUNDS, type MarqueeFund } from "./dashboard";
import { getSnapshot } from "./snapshots";
import type { BacktestTrade } from "./backtest";

// Re-export the pure-data CUSIP lookups so existing import paths still work.
// New code (especially client components) should import from cusip-lookup
// directly to avoid pulling this file's server-only transitive deps
// (snapshots, edgar, disk-cache) into the browser bundle.
export { cusipsForTicker, tickerForCusip } from "./cusip-lookup";
import { cusipsForTicker } from "./cusip-lookup";

export type CurrentStake = {
  fund: MarqueeFund;
  status: "current";
  // Shares as disclosed at the trade's open filing. Frozen at the time the
  // position was opened — NOT a running count, so for long-held positions
  // (Berkshire's AAPL etc.) this understates today's true share count by
  // the cumulative net adds. Reliable only when entryDate equals the fund's
  // latest activity date (i.e. the position was just opened).
  sharesAtOpen: number;
  entryDate: string;
  entrySharePrice: number;
  currentPrice: number | null;
  // Price-only return since entry. Independent of share count, so this is
  // reliable even for long-held positions.
  priceReturnPct: number | null;
  // Earliest entry date across all (potentially multiple) trades the fund had
  // in this CUSIP. A tenure proxy when a fund opens / closes / re-opens.
  firstEverEntryDate: string;
  // Approximate quarters held, computed at view-build time. Precomputed so
  // page renders stay pure (React 19 forbids Date.now() in render).
  heldQuartersApprox: number;
  // Total number of distinct trade lifecycles in this CUSIP.
  tradeCount: number;
  trades: BacktestTrade[];
};

export type ExitedStake = {
  fund: MarqueeFund;
  status: "exited";
  exitDate: string;
  exitSharePrice: number | null;
  closedReturnPct: number;
  // Most-recent trade's entry, not necessarily the first ever.
  entryDate: string;
  tradeCount: number;
  trades: BacktestTrade[];
};

export type NeverStake = {
  fund: MarqueeFund;
  status: "never";
  trades: [];
};

export type FundStake = CurrentStake | ExitedStake | NeverStake;

export type StockView = {
  ticker: string;
  issuer: string;
  cusips: string[];
  latestPrice: number | null;
  stakes: FundStake[];
  currentHolders: CurrentStake[];
  pastHolders: ExitedStake[];
  newThisQuarter: CurrentStake[];
  exitedThisQuarter: ExitedStake[];
  // Count of funds holding at each event date (entry or exit) — used for a
  // small sparkline showing whether the name is gaining or losing followers.
  ownershipTimeline: { date: string; count: number }[];
};

// Per-fund "latest filing date" used to decide what "this quarter" means.
// Defined as the max entry-or-exit date across ALL the fund's snapshot
// trades — i.e. the date of the most recently disclosed move. Cached so we
// only walk a snapshot's trades once.
const latestActivityByCik = new Map<string, string>();

function latestActivityDate(cik: string): string {
  const cached = latestActivityByCik.get(cik);
  if (cached !== undefined) return cached;
  const snap = getSnapshot(cik);
  if (!snap) {
    latestActivityByCik.set(cik, "");
    return "";
  }
  let max = "";
  for (const t of snap.trades) {
    if (t.entryDate > max) max = t.entryDate;
    if (t.exitDate && t.exitDate > max) max = t.exitDate;
  }
  latestActivityByCik.set(cik, max);
  return max;
}

export const getStockView = cache((tickerInput: string): StockView | null => {
  const ticker = tickerInput.trim().toUpperCase();
  const cusips = cusipsForTicker(ticker);
  if (cusips.length === 0) return null;
  const cusipSet = new Set(cusips);
  // Sampled once per view; safe inside cache() since the result is memoized
  // for the duration of a render pass.
  const nowMs = Date.now();

  const stakes: FundStake[] = [];
  let bestIssuer = "";
  let latestPrice: number | null = null;
  // For ownership timeline: collect (entry, exit-or-null) intervals across all
  // funds. A null `end` means "still held."
  const intervals: Array<{ start: string; end: string | null }> = [];

  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) {
      stakes.push({ fund, status: "never", trades: [] });
      continue;
    }
    const matching = snap.trades.filter((t) => cusipSet.has(t.cusip));
    if (matching.length === 0) {
      stakes.push({ fund, status: "never", trades: [] });
      continue;
    }
    for (const t of matching) {
      if (t.issuer && t.issuer.length > bestIssuer.length) bestIssuer = t.issuer;
    }
    if (latestPrice == null) {
      // Look up the ticker as bundled in the snapshot — trades carry a ticker
      // field, so we don't need to re-resolve.
      const tradeTicker = matching.find((t) => t.ticker)?.ticker;
      if (tradeTicker && snap.latestPriceByTicker[tradeTicker] != null) {
        latestPrice = snap.latestPriceByTicker[tradeTicker];
      }
    }
    for (const t of matching) {
      intervals.push({ start: t.entryDate, end: t.exitDate });
    }

    const sorted = [...matching].sort((a, b) =>
      a.entryDate.localeCompare(b.entryDate),
    );
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    const firstEverEntryDate = first.entryDate;

    if (latest.status === "open") {
      // Pair `entrySharePrice` with the FIRST-EVER trade (not the latest
      // re-entry) so the "First bought Q3 2013, Entry $X" row in the
      // holders table reflects the price at that first disclosure.
      // Previously this read from `latest.entrySharePrice`, which silently
      // mis-paired the price (latest re-open) with the date (first ever) —
      // e.g. Bridgewater AAPL showed "First bought Q3 2013, Entry $182"
      // when 2013 AAPL was actually ~$15.
      const entrySharePrice = first.entrySharePrice;
      const priceReturnPct =
        latestPrice != null && entrySharePrice > 0
          ? (latestPrice / entrySharePrice - 1) * 100
          : null;
      const heldQuartersApprox = Math.max(
        1,
        Math.round(
          (nowMs - new Date(firstEverEntryDate + "T00:00:00Z").getTime()) /
            (90 * 86400000),
        ),
      );
      stakes.push({
        fund,
        status: "current",
        sharesAtOpen: latest.shares,
        entryDate: latest.entryDate,
        entrySharePrice,
        currentPrice: latestPrice,
        priceReturnPct,
        firstEverEntryDate,
        heldQuartersApprox,
        tradeCount: sorted.length,
        trades: sorted,
      });
    } else {
      stakes.push({
        fund,
        status: "exited",
        exitDate: latest.exitDate ?? "",
        exitSharePrice: latest.exitSharePrice,
        closedReturnPct: latest.returnPct,
        entryDate: latest.entryDate,
        tradeCount: sorted.length,
        trades: sorted,
      });
    }
  }

  // "This quarter" detection: a fund's latest activity date is the max
  // entry-or-exit date across its entire snapshot. A stake counts as
  // "this quarter" if its event date matches that fund's latest activity.
  const newThisQuarter: CurrentStake[] = [];
  const exitedThisQuarter: ExitedStake[] = [];
  for (const s of stakes) {
    if (s.status === "current") {
      const latestForFund = latestActivityDate(s.fund.cik);
      if (latestForFund && s.entryDate === latestForFund) newThisQuarter.push(s);
    } else if (s.status === "exited") {
      const latestForFund = latestActivityDate(s.fund.cik);
      if (latestForFund && s.exitDate === latestForFund) exitedThisQuarter.push(s);
    }
  }

  // Sort current holders by tenure (longest-held first). This is honest with
  // the data we have: the snapshot can't reliably report current dollar value
  // for positions that have been added to over time.
  const currentHolders = stakes
    .filter((s): s is CurrentStake => s.status === "current")
    .sort((a, b) =>
      a.firstEverEntryDate.localeCompare(b.firstEverEntryDate),
    );
  const pastHolders = stakes
    .filter((s): s is ExitedStake => s.status === "exited")
    .sort((a, b) => b.exitDate.localeCompare(a.exitDate));

  // Build ownership timeline: at each unique start/end date in the universe,
  // count how many intervals are active. This is the "number of marquee funds
  // holding this name over time" series.
  const dateSet = new Set<string>();
  for (const iv of intervals) {
    dateSet.add(iv.start);
    if (iv.end) dateSet.add(iv.end);
  }
  const datesSorted = Array.from(dateSet).sort();
  const ownershipTimeline = datesSorted.map((d) => {
    let count = 0;
    for (const iv of intervals) {
      if (iv.start <= d && (!iv.end || iv.end > d)) count++;
    }
    return { date: d, count };
  });

  // If literally no fund touched this name, treat as not-coverable rather than
  // returning an empty hull. Callers can decide whether to 404 or show a soft
  // "no coverage" state.
  if (currentHolders.length === 0 && pastHolders.length === 0) {
    return {
      ticker,
      issuer: bestIssuer || ticker,
      cusips,
      latestPrice,
      stakes,
      currentHolders,
      pastHolders,
      newThisQuarter,
      exitedThisQuarter,
      ownershipTimeline,
    };
  }

  return {
    ticker,
    issuer: bestIssuer || ticker,
    cusips,
    latestPrice,
    stakes,
    currentHolders,
    pastHolders,
    newThisQuarter,
    exitedThisQuarter,
    ownershipTimeline,
  };
});
