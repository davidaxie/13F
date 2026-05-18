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

export type FollowerBacktest = {
  positionSizeUsd: number;
  signals: EnrichedSignal[];
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

  return {
    positionSizeUsd: POSITION_SIZE_USD,
    signals: enriched,
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
