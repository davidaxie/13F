import { cache } from "react";
import { MARQUEE_FUNDS, type MarqueeFund } from "./dashboard";
import { getSnapshot } from "./snapshots";
import { tickerForCusip } from "./stock-view";
import type { BacktestTrade } from "./backtest";

export type FundActivity = {
  fund: MarqueeFund;
  entryDate: string;
  // Snapshot-recorded shares (frozen at open time — see stock-view.ts caveats).
  sharesAtOpen: number;
  entryValueUsd: number;
};

export type ConsensusName = {
  cusip: string;
  ticker: string | null;
  issuer: string;
  // All funds currently holding (latest trade is open).
  holders: FundActivity[];
  // Funds whose latest open trade was opened on their most recent filing date.
  newThisQuarter: FundActivity[];
  // Funds whose latest trade is closed and exited on their most recent filing date.
  exitedThisQuarter: FundActivity[];
  // Sums.
  totalHolders: number;
  netNewMinusExits: number;
  totalEntryValueUsd: number;
};

export type ConsensusView = {
  mostOwned: ConsensusName[];        // sorted by holder count, then by capital
  consensusNewBuys: ConsensusName[]; // ≥3 funds newly opened in their latest quarter
  consensusExits: ConsensusName[];   // ≥3 funds fully sold in their latest quarter
  disagreement: ConsensusName[];     // ≥2 new AND ≥2 exited this quarter — research signal
  // Dashboard hero lists — a softer ≥2-fund floor so the front page is
  // always populated, sorted by fund-count then capital. The count is shown
  // in the UI so a 2-fund vs 6-fund consensus is distinguishable.
  topBuys: ConsensusName[];
  topExits: ConsensusName[];
  asOfDate: string;                  // latest activity across the universe
  fundsCovered: number;
};

const MIN_HOLDERS_FOR_CONSENSUS = 2; // floor for "most owned" (drops singletons)
const MIN_FOR_CONSENSUS_MOVE = 3;    // ≥3 funds = a real consensus move
const MIN_FOR_DISAGREEMENT = 2;      // ≥2 each side = meaningful split
const MIN_FOR_DASHBOARD = 2;         // ≥2 funds = the softest "consensus" worth a hero row

// Per-fund "latest activity date" — proxy for the fund's most recent filing.
function latestActivityDate(snap: ReturnType<typeof getSnapshot>): string {
  if (!snap) return "";
  let max = "";
  for (const t of snap.trades) {
    if (t.entryDate > max) max = t.entryDate;
    if (t.exitDate && t.exitDate > max) max = t.exitDate;
  }
  return max;
}

export const computeConsensusView = cache((): ConsensusView => {
  // Build per-fund "latest activity date" once.
  const fundLatestDate = new Map<string, string>();
  let fundsCovered = 0;
  for (const f of MARQUEE_FUNDS) {
    const snap = getSnapshot(f.cik);
    if (!snap) continue;
    fundsCovered++;
    fundLatestDate.set(f.cik, latestActivityDate(snap));
  }

  // Aggregate by CUSIP across all funds. For each CUSIP per fund, take the
  // LATEST trade (by entryDate) as the current state — that's the most recent
  // open/close lifecycle.
  type Acc = {
    cusip: string;
    issuer: string;
    holders: FundActivity[];
    newThisQuarter: FundActivity[];
    exitedThisQuarter: FundActivity[];
  };
  const byCusip = new Map<string, Acc>();

  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) continue;
    const latestForFund = fundLatestDate.get(fund.cik) ?? "";

    // Per-CUSIP, keep only the latest trade lifecycle.
    const latestTradeByCusip = new Map<string, BacktestTrade>();
    for (const t of snap.trades) {
      const cur = latestTradeByCusip.get(t.cusip);
      if (!cur || t.entryDate > cur.entryDate) {
        latestTradeByCusip.set(t.cusip, t);
      }
    }

    for (const [cusip, t] of latestTradeByCusip) {
      let acc = byCusip.get(cusip);
      if (!acc) {
        acc = {
          cusip,
          issuer: t.issuer,
          holders: [],
          newThisQuarter: [],
          exitedThisQuarter: [],
        };
        byCusip.set(cusip, acc);
      }
      // Keep the longest issuer name seen — proxy for "cleanest" string.
      if (t.issuer && t.issuer.length > acc.issuer.length) {
        acc.issuer = t.issuer;
      }

      const activity: FundActivity = {
        fund,
        entryDate: t.entryDate,
        sharesAtOpen: t.shares,
        entryValueUsd: t.entryValueUsd,
      };

      if (t.status === "open") {
        acc.holders.push(activity);
        if (t.entryDate === latestForFund) {
          acc.newThisQuarter.push(activity);
        }
      } else if (t.status === "closed") {
        if (t.exitDate && t.exitDate === latestForFund) {
          acc.exitedThisQuarter.push(activity);
        }
      }
    }
  }

  // Materialize into ConsensusName + apply summaries.
  const names: ConsensusName[] = [];
  for (const acc of byCusip.values()) {
    const totalEntryValueUsd = acc.holders.reduce(
      (s, h) => s + h.entryValueUsd,
      0,
    );
    names.push({
      cusip: acc.cusip,
      ticker: tickerForCusip(acc.cusip),
      issuer: acc.issuer,
      holders: acc.holders,
      newThisQuarter: acc.newThisQuarter,
      exitedThisQuarter: acc.exitedThisQuarter,
      totalHolders: acc.holders.length,
      netNewMinusExits:
        acc.newThisQuarter.length - acc.exitedThisQuarter.length,
      totalEntryValueUsd,
    });
  }

  // Latest activity across the whole universe = "as of" date.
  let asOfDate = "";
  for (const d of fundLatestDate.values()) {
    if (d > asOfDate) asOfDate = d;
  }

  const mostOwned = names
    .filter((n) => n.totalHolders >= MIN_HOLDERS_FOR_CONSENSUS)
    .sort(
      (a, b) =>
        b.totalHolders - a.totalHolders ||
        b.totalEntryValueUsd - a.totalEntryValueUsd,
    );

  const consensusNewBuys = names
    .filter((n) => n.newThisQuarter.length >= MIN_FOR_CONSENSUS_MOVE)
    .sort(
      (a, b) =>
        b.newThisQuarter.length - a.newThisQuarter.length ||
        b.totalEntryValueUsd - a.totalEntryValueUsd,
    );

  const consensusExits = names
    .filter((n) => n.exitedThisQuarter.length >= MIN_FOR_CONSENSUS_MOVE)
    .sort(
      (a, b) => b.exitedThisQuarter.length - a.exitedThisQuarter.length,
    );

  const disagreement = names
    .filter(
      (n) =>
        n.newThisQuarter.length >= MIN_FOR_DISAGREEMENT &&
        n.exitedThisQuarter.length >= MIN_FOR_DISAGREEMENT,
    )
    .sort(
      (a, b) =>
        b.newThisQuarter.length +
        b.exitedThisQuarter.length -
        (a.newThisQuarter.length + a.exitedThisQuarter.length),
    );

  // Dashboard hero lists: softer ≥2-fund floor, ranked by how many funds
  // moved together (then by capital). Always-populated front-page signal.
  const topBuys = names
    .filter((n) => n.newThisQuarter.length >= MIN_FOR_DASHBOARD)
    .sort(
      (a, b) =>
        b.newThisQuarter.length - a.newThisQuarter.length ||
        b.totalEntryValueUsd - a.totalEntryValueUsd,
    );

  const topExits = names
    .filter((n) => n.exitedThisQuarter.length >= MIN_FOR_DASHBOARD)
    .sort(
      (a, b) =>
        b.exitedThisQuarter.length - a.exitedThisQuarter.length ||
        b.totalEntryValueUsd - a.totalEntryValueUsd,
    );

  return {
    mostOwned,
    consensusNewBuys,
    consensusExits,
    disagreement,
    topBuys,
    topExits,
    asOfDate,
    fundsCovered,
  };
});
