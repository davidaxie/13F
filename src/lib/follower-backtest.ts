import { cache } from "react";
import { MARQUEE_FUNDS } from "./dashboard";
import { getSnapshot } from "./snapshots";
import { priceAt, isoToUnix, type Bar } from "./prices";
import spyData from "./spy-prices.json";

const SPY_BARS: Bar[] = spyData.bars as Bar[];
const POSITION_SIZE_USD = 10000;

export type EnrichedSignal = {
  fundCik: string;
  fundName: string;
  cusip: string;
  ticker: string;
  issuer: string;
  buyDate: string;
  sellDate: string | null;
  buyPrice: number;
  sellPrice: number;
  status: "closed" | "open";
  sharesBought: number;       // $10k / buyPrice
  finalValueUsd: number;      // sharesBought × sellPrice
  pnlUsd: number;             // finalValueUsd - $10k
  returnPct: number;
  // SPY benchmark over same buy→sell window:
  spyBuyPrice: number;
  spySellPrice: number;
  spyReturnPct: number;
  spyFinalValueUsd: number;   // $10k × (spySell / spyBuy)
  alphaUsd: number;           // finalValueUsd - spyFinalValueUsd
  alphaPct: number;           // returnPct - spyReturnPct
  holdDays: number;
};

export type PerFundSummary = {
  fundCik: string;
  fundName: string;
  signals: number;
  invested: number;
  followerFinal: number;
  spyFinal: number;
  alphaUsd: number;
  followerReturnPct: number;
  spyReturnPct: number;
  alphaPct: number;
  winRate: number;
};

export type RealizedPoint = {
  date: string;
  cumulativeAlphaUsd: number;
  cumulativeFollowerPnlUsd: number;
  cumulativeSpyPnlUsd: number;
};

export type CostVariant = {
  bpsPerSide: number; // 0, 5, 10, 25
  followerFinalUsd: number;
  followerReturnPct: number;
  alphaUsd: number;
  alphaPct: number;
  winRate: number;
  avgReturnPct: number;
  medianReturnPct: number;
};

export type FollowerBacktest = {
  positionSizeUsd: number;
  signals: EnrichedSignal[];
  costVariants: CostVariant[];
  stats: {
    totalSignals: number;
    closedSignals: number;
    openSignals: number;
    totalInvestedUsd: number;
    followerFinalUsd: number;
    spyFinalUsd: number;
    followerReturnPct: number;
    spyReturnPct: number;
    alphaUsd: number;
    alphaPct: number;
    winRate: number;
    avgReturnPct: number;
    medianReturnPct: number;
    avgHoldDays: number;
    bestSignal: EnrichedSignal | null;
    worstSignal: EnrichedSignal | null;
    biggestAlpha: EnrichedSignal | null;
    biggestNegAlpha: EnrichedSignal | null;
  };
  perFund: PerFundSummary[];
  realizedSeries: RealizedPoint[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00Z").getTime();
  const b = new Date(bIso + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

function _compute(): FollowerBacktest {
  const enriched: EnrichedSignal[] = [];

  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) continue;

    for (const sig of snap.buySignals) {
      // Filter: must have a ticker, valid buy price, and either a closed
      // sell price or a mark-to-market price.
      if (!sig.ticker || sig.buyPrice <= 0) continue;
      const sellPrice = sig.sellPrice;
      if (sellPrice == null || sellPrice <= 0) continue;

      const sharesBought = POSITION_SIZE_USD / sig.buyPrice;
      const finalValueUsd = sharesBought * sellPrice;
      const pnlUsd = finalValueUsd - POSITION_SIZE_USD;
      const returnPct = (sellPrice / sig.buyPrice - 1) * 100;

      // SPY benchmark for the same window.
      const sellDate = sig.sellDate ?? todayIso();
      const spyBuy = priceAt(SPY_BARS, isoToUnix(sig.buyDate));
      const spySell = priceAt(SPY_BARS, isoToUnix(sellDate));
      if (spyBuy == null || spySell == null || spyBuy <= 0) continue;
      const spyReturnPct = (spySell / spyBuy - 1) * 100;
      const spyFinalValueUsd = POSITION_SIZE_USD * (spySell / spyBuy);
      const alphaUsd = finalValueUsd - spyFinalValueUsd;
      const alphaPct = returnPct - spyReturnPct;
      const holdDays = daysBetween(sig.buyDate, sellDate);

      enriched.push({
        fundCik: fund.cik,
        fundName: fund.displayName,
        cusip: sig.cusip,
        ticker: sig.ticker,
        issuer: sig.issuer,
        buyDate: sig.buyDate,
        sellDate: sig.sellDate,
        buyPrice: sig.buyPrice,
        sellPrice,
        status: sig.status,
        sharesBought,
        finalValueUsd,
        pnlUsd,
        returnPct,
        spyBuyPrice: spyBuy,
        spySellPrice: spySell,
        spyReturnPct,
        spyFinalValueUsd,
        alphaUsd,
        alphaPct,
        holdDays,
      });
    }
  }

  // Aggregate stats.
  const N = enriched.length;
  const closedSignals = enriched.filter((s) => s.status === "closed").length;
  const totalInvested = N * POSITION_SIZE_USD;
  const followerFinal = enriched.reduce((s, e) => s + e.finalValueUsd, 0);
  const spyFinal = enriched.reduce((s, e) => s + e.spyFinalValueUsd, 0);
  const winners = enriched.filter((e) => e.alphaUsd > 0).length;
  const sumReturn = enriched.reduce((s, e) => s + e.returnPct, 0);
  const sumHold = enriched.reduce((s, e) => s + e.holdDays, 0);

  const sortedReturns = enriched.map((e) => e.returnPct).sort((a, b) => a - b);
  const medianReturnPct =
    sortedReturns.length > 0
      ? sortedReturns[Math.floor(sortedReturns.length / 2)]
      : 0;

  const best = enriched.length > 0
    ? enriched.reduce((a, b) => (a.returnPct > b.returnPct ? a : b))
    : null;
  const worst = enriched.length > 0
    ? enriched.reduce((a, b) => (a.returnPct < b.returnPct ? a : b))
    : null;
  const biggestAlpha = enriched.length > 0
    ? enriched.reduce((a, b) => (a.alphaUsd > b.alphaUsd ? a : b))
    : null;
  const biggestNegAlpha = enriched.length > 0
    ? enriched.reduce((a, b) => (a.alphaUsd < b.alphaUsd ? a : b))
    : null;

  // Per-fund.
  const perFund: PerFundSummary[] = MARQUEE_FUNDS.map((fund) => {
    const fs = enriched.filter((e) => e.fundCik === fund.cik);
    const fInv = fs.length * POSITION_SIZE_USD;
    const fFin = fs.reduce((s, e) => s + e.finalValueUsd, 0);
    const fSpy = fs.reduce((s, e) => s + e.spyFinalValueUsd, 0);
    const fAlpha = fFin - fSpy;
    const fWins = fs.filter((e) => e.alphaUsd > 0).length;
    return {
      fundCik: fund.cik,
      fundName: fund.displayName,
      signals: fs.length,
      invested: fInv,
      followerFinal: fFin,
      spyFinal: fSpy,
      alphaUsd: fAlpha,
      followerReturnPct: fInv > 0 ? ((fFin - fInv) / fInv) * 100 : 0,
      spyReturnPct: fInv > 0 ? ((fSpy - fInv) / fInv) * 100 : 0,
      alphaPct: fInv > 0 ? (fAlpha / fInv) * 100 : 0,
      winRate: fs.length > 0 ? fWins / fs.length : 0,
    };
  })
    .filter((f) => f.signals > 0)
    .sort((a, b) => b.alphaUsd - a.alphaUsd);

  // Realized cumulative series — order signals by sell date and compound.
  const realizedClosed = enriched
    .filter((e) => e.status === "closed" && e.sellDate)
    .sort((a, b) => (a.sellDate ?? "").localeCompare(b.sellDate ?? ""));

  const realizedSeries: RealizedPoint[] = [];
  let cumF = 0;
  let cumS = 0;
  let lastDate = "";
  for (const s of realizedClosed) {
    cumF += s.pnlUsd;
    cumS += s.spyFinalValueUsd - POSITION_SIZE_USD;
    if (s.sellDate !== lastDate) {
      // Only emit a point per unique date to keep series compact.
      realizedSeries.push({
        date: s.sellDate!,
        cumulativeFollowerPnlUsd: cumF,
        cumulativeSpyPnlUsd: cumS,
        cumulativeAlphaUsd: cumF - cumS,
      });
      lastDate = s.sellDate!;
    } else {
      realizedSeries[realizedSeries.length - 1] = {
        date: s.sellDate!,
        cumulativeFollowerPnlUsd: cumF,
        cumulativeSpyPnlUsd: cumS,
        cumulativeAlphaUsd: cumF - cumS,
      };
    }
  }

  const costVariants = computeCostVariants(enriched, POSITION_SIZE_USD, [
    0, 5, 10, 25,
  ]);

  return {
    positionSizeUsd: POSITION_SIZE_USD,
    signals: enriched,
    costVariants,
    stats: {
      totalSignals: N,
      closedSignals,
      openSignals: N - closedSignals,
      totalInvestedUsd: totalInvested,
      followerFinalUsd: followerFinal,
      spyFinalUsd: spyFinal,
      followerReturnPct:
        totalInvested > 0
          ? ((followerFinal - totalInvested) / totalInvested) * 100
          : 0,
      spyReturnPct:
        totalInvested > 0
          ? ((spyFinal - totalInvested) / totalInvested) * 100
          : 0,
      alphaUsd: followerFinal - spyFinal,
      alphaPct:
        totalInvested > 0
          ? ((followerFinal - spyFinal) / totalInvested) * 100
          : 0,
      winRate: N > 0 ? winners / N : 0,
      avgReturnPct: N > 0 ? sumReturn / N : 0,
      medianReturnPct,
      avgHoldDays: N > 0 ? sumHold / N : 0,
      bestSignal: best,
      worstSignal: worst,
      biggestAlpha,
      biggestNegAlpha,
    },
    perFund,
    realizedSeries,
  };
}

export const computeFollowerBacktest = cache(_compute);

/**
 * Apply a per-side slippage assumption to every signal and return aggregate
 * cost-adjusted stats per requested basis-point level. Round-trip cost = 2×
 * bpsPerSide (paid on the buy AND sell side). SPY benchmark is assumed
 * cost-free — the comparison answers "what did the follower realize vs an
 * idealized buy-and-hold SPY of the same dollars?"
 *
 * Per-fund and the realized series stay as gross-only (re-doing those is
 * unnecessary for the current UX and would bloat the payload).
 */
export function computeCostVariants(
  signals: EnrichedSignal[],
  positionSizeUsd: number,
  bpsLevels: number[],
): CostVariant[] {
  return bpsLevels.map((bps) => {
    const slip = bps / 10000; // e.g. 5 bps = 0.0005
    let followerFinal = 0;
    let spyFinal = 0;
    let wins = 0;
    let sumReturn = 0;
    const returns: number[] = [];

    for (const s of signals) {
      // Pay slip on the buy side (price effectively higher), receive slip
      // less on the sell side (price effectively lower).
      const buyEff = s.buyPrice * (1 + slip);
      const sellEff = s.sellPrice * (1 - slip);
      const sharesEff = positionSizeUsd / buyEff;
      const finalValueEff = sharesEff * sellEff;
      const retEff = (finalValueEff / positionSizeUsd - 1) * 100;
      const alphaUsdEff = finalValueEff - s.spyFinalValueUsd;

      followerFinal += finalValueEff;
      spyFinal += s.spyFinalValueUsd;
      if (alphaUsdEff > 0) wins++;
      sumReturn += retEff;
      returns.push(retEff);
    }

    const N = signals.length;
    const totalInvested = N * positionSizeUsd;
    returns.sort((a, b) => a - b);

    return {
      bpsPerSide: bps,
      followerFinalUsd: followerFinal,
      followerReturnPct:
        totalInvested > 0
          ? ((followerFinal - totalInvested) / totalInvested) * 100
          : 0,
      alphaUsd: followerFinal - spyFinal,
      alphaPct:
        totalInvested > 0
          ? ((followerFinal - spyFinal) / totalInvested) * 100
          : 0,
      winRate: N > 0 ? wins / N : 0,
      avgReturnPct: N > 0 ? sumReturn / N : 0,
      medianReturnPct:
        returns.length > 0 ? returns[Math.floor(returns.length / 2)] : 0,
    };
  });
}
