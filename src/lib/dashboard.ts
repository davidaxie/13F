import { cache } from "react";
import {
  getFundInfo,
  getHoldings,
  isValueInThousands,
  type Filing,
  type FundInfo,
} from "./edgar";
import type { Holding } from "./parse-13f";
import { quarterLabel } from "./format";

// Marquee fund list lives in ./funds (a pure-data module safe to import
// from client components). Re-exported here so existing callers continue
// to work; new client-side code should prefer importing from ./funds
// directly to avoid pulling this module's server-only transitive deps
// (disk-cache, edgar fetch) into the browser bundle.
export {
  FUND_STYLE_LABELS,
  MARQUEE_FUNDS,
  type FundStyle,
  type MarqueeFund,
} from "./funds";

import { MARQUEE_FUNDS } from "./funds";

export type MoveType = "new" | "exited" | "added" | "trimmed";

export type Move = {
  fundCik: string;
  fundName: string;
  quarter: string;
  filingAccession: string;
  issuer: string;
  cusip: string;
  titleOfClass: string;
  putCall?: string;
  type: MoveType;
  currentValueUsd: number;
  prevValueUsd: number;
  deltaUsd: number;
  deltaSharesPct: number | null;
  // Position's weight in the fund's portfolio. For new/added/trimmed this is
  // the *current* filing's weight; for exited it's the *prev* filing's weight
  // (the position's last-known size before the exit).
  weightInPortfolio: number;
  // Prev filing's weight, populated only for "added" and "trimmed" so we can
  // compute Δweight (= weightInPortfolio − prevWeightInPortfolio). For "new"
  // it's 0 by definition; for "exited" it's identical to weightInPortfolio.
  prevWeightInPortfolio?: number;
};

export type FundDiff = {
  info: FundInfo;
  latest: Filing;
  prev: Filing | null;
  positionsCurrent: number;
  totalValueCurrentUsd: number;
  totalValuePrevUsd: number;
  moves: Move[];
};

function toDollars(value: number, filingDate: string): number {
  return isValueInThousands(filingDate) ? value * 1000 : value;
}

function aggregateByCusip(rows: Holding[]): Map<string, Holding> {
  const map = new Map<string, Holding>();
  for (const r of rows) {
    const k = `${r.cusip}|${r.titleOfClass}|${r.putCall ?? ""}`;
    const existing = map.get(k);
    if (existing) {
      existing.value += r.value;
      existing.shares += r.shares;
    } else {
      map.set(k, { ...r });
    }
  }
  return map;
}

async function _getFundDiff(
  cik: string,
  displayName: string,
): Promise<FundDiff | null> {
  try {
    const info = await getFundInfo(cik);
    if (info.filings.length === 0) return null;
    const latest = info.filings[0];
    const prev = info.filings[1] ?? null;

    const [latestHoldings, prevHoldings] = await Promise.all([
      getHoldings(cik, latest.accessionNumber).catch(() => null),
      prev
        ? getHoldings(cik, prev.accessionNumber).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!latestHoldings) return null;

    const currMap = aggregateByCusip(latestHoldings);
    const prevMap = prevHoldings
      ? aggregateByCusip(prevHoldings)
      : new Map<string, Holding>();

    const totalCurrentUsd = Array.from(currMap.values()).reduce(
      (s, h) => s + toDollars(h.value, latest.filingDate),
      0,
    );
    const totalPrevUsd = prev
      ? Array.from(prevMap.values()).reduce(
          (s, h) => s + toDollars(h.value, prev.filingDate),
          0,
        )
      : 0;

    const moves: Move[] = [];
    const qLabel = quarterLabel(latest.reportDate);

    for (const [k, h] of currMap) {
      const currentValueUsd = toDollars(h.value, latest.filingDate);
      const prevH = prevMap.get(k);
      const weight =
        totalCurrentUsd > 0 ? (currentValueUsd / totalCurrentUsd) * 100 : 0;

      if (!prevH || !prev) {
        if (prev) {
          moves.push({
            fundCik: cik,
            fundName: displayName,
            quarter: qLabel,
            filingAccession: latest.accessionNumber,
            issuer: h.issuer,
            cusip: h.cusip,
            titleOfClass: h.titleOfClass,
            putCall: h.putCall,
            type: "new",
            currentValueUsd,
            prevValueUsd: 0,
            deltaUsd: currentValueUsd,
            deltaSharesPct: null,
            weightInPortfolio: weight,
          });
        }
        continue;
      }

      if (prevH.shares === h.shares) continue;

      const prevValueUsd = toDollars(prevH.value, prev.filingDate);
      const deltaUsd = currentValueUsd - prevValueUsd;
      const deltaSharesPct =
        prevH.shares > 0
          ? ((h.shares - prevH.shares) / prevH.shares) * 100
          : null;
      const prevWeight =
        totalPrevUsd > 0 ? (prevValueUsd / totalPrevUsd) * 100 : 0;
      moves.push({
        fundCik: cik,
        fundName: displayName,
        quarter: qLabel,
        filingAccession: latest.accessionNumber,
        issuer: h.issuer,
        cusip: h.cusip,
        titleOfClass: h.titleOfClass,
        putCall: h.putCall,
        type: h.shares > prevH.shares ? "added" : "trimmed",
        currentValueUsd,
        prevValueUsd,
        deltaUsd,
        deltaSharesPct,
        weightInPortfolio: weight,
        prevWeightInPortfolio: prevWeight,
      });
    }

    if (prev) {
      for (const [k, h] of prevMap) {
        if (currMap.has(k)) continue;
        const prevValueUsd = toDollars(h.value, prev.filingDate);
        const weight =
          totalPrevUsd > 0 ? (prevValueUsd / totalPrevUsd) * 100 : 0;
        moves.push({
          fundCik: cik,
          fundName: displayName,
          quarter: qLabel,
          filingAccession: latest.accessionNumber,
          issuer: h.issuer,
          cusip: h.cusip,
          titleOfClass: h.titleOfClass,
          putCall: h.putCall,
          type: "exited",
          currentValueUsd: 0,
          prevValueUsd,
          deltaUsd: -prevValueUsd,
          deltaSharesPct: -100,
          weightInPortfolio: weight,
        });
      }
    }

    return {
      info,
      latest,
      prev,
      positionsCurrent: currMap.size,
      totalValueCurrentUsd: totalCurrentUsd,
      totalValuePrevUsd: totalPrevUsd,
      moves,
    };
  } catch {
    return null;
  }
}

export const getFundDiff = cache(_getFundDiff);

export async function getAllFundDiffs(): Promise<FundDiff[]> {
  const results = await Promise.all(
    MARQUEE_FUNDS.map((f) => getFundDiff(f.cik, f.displayName)),
  );
  return results.filter((r): r is FundDiff => r !== null);
}

export type TopHolding = {
  issuer: string;
  cusip: string;
  titleOfClass: string;
  putCall?: string;
  valueUsd: number;
  shares: number;
  weightInPortfolio: number;
};

export type TopHoldingsResult = {
  reportDate: string;
  filingDate: string;
  accessionNumber: string;
  totalValueUsd: number;
  positionCount: number;
  rows: TopHolding[];
};

async function _getTopHoldings(
  cik: string,
  limit = 10,
): Promise<TopHoldingsResult | null> {
  try {
    const info = await getFundInfo(cik);
    if (info.filings.length === 0) return null;
    const latest = info.filings[0];
    const holdings = await getHoldings(cik, latest.accessionNumber).catch(
      () => null,
    );
    if (!holdings) return null;

    const map = aggregateByCusip(holdings);
    const totalRaw = Array.from(map.values()).reduce((s, h) => s + h.value, 0);
    const totalUsd = toDollars(totalRaw, latest.filingDate);

    const rows: TopHolding[] = Array.from(map.values())
      .map((h) => {
        const valueUsd = toDollars(h.value, latest.filingDate);
        return {
          issuer: h.issuer,
          cusip: h.cusip,
          titleOfClass: h.titleOfClass,
          putCall: h.putCall,
          valueUsd,
          shares: h.shares,
          weightInPortfolio: totalRaw > 0 ? (h.value / totalRaw) * 100 : 0,
        };
      })
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .slice(0, limit);

    return {
      reportDate: latest.reportDate,
      filingDate: latest.filingDate,
      accessionNumber: latest.accessionNumber,
      totalValueUsd: totalUsd,
      positionCount: map.size,
      rows,
    };
  } catch {
    return null;
  }
}

export const getTopHoldings = cache(_getTopHoldings);
