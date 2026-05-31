import { cache } from "react";
import { MARQUEE_FUNDS } from "./dashboard";
import { getSnapshot } from "./snapshots";
import { priceAt, isoToUnix, type Bar } from "./prices";
import spyData from "./spy-prices.json";

const SPY_BARS: Bar[] = spyData.bars as Bar[];
const POSITION_SIZE_USD = 10000;

/** Conviction filter steps in quarters. Each value caches its own bucket. */
const HOLD_QUARTER_BUCKETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20] as const;

export type ConvictionSignal = {
  fundCik: string;
  fundName: string;
  cusip: string;
  ticker: string;
  issuer: string;
  buyDate: string;
  buyPrice: number;
  todayPrice: number;
  positionHoldDays: number;     // earliest buy → latest sell (or today) for this fund+cusip
  returnPct: number;
  finalValueUsd: number;
  pnlUsd: number;
  spyBuyPrice: number;
  spyTodayPrice: number;
  spyReturnPct: number;
  spyFinalValueUsd: number;
  alphaUsd: number;
  alphaPct: number;
  // Fund-exit-mode fields: sell price = fund's own exit price (or today if
  // still open). SPY benchmark matched to the same window.
  fundExitPrice: number;            // sell price under fund-exit mode
  fundExitFinalValueUsd: number;    // sharesBought × fundExitPrice
  fundExitReturnPct: number;
  spyFundExitFinalValueUsd: number; // SPY held over fund's buy→exit window
  fundExitAlphaUsd: number;
};

export type ConvictionStats = {
  minHoldQuarters: number;
  totalSignals: number;
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
  avgHoldQuarters: number;
};

/**
 * Alternative "exit at the fund's actual sell" stats, computed alongside the
 * default "hold to today" view. For closed signals the sell price is the
 * fund's own exit price (from snapshot); for still-open signals the sell
 * price is today (no choice). The benchmark is matched: SPY is sold on the
 * same fund-exit date for closed signals, today for open ones.
 *
 * Comparing the two modes isolates "did the fund know when to sell?" — if
 * fund-exit alpha > hold-to-today alpha, the fund's exit timing added value;
 * if the reverse, the fund sold too early and the follower would've done
 * better holding longer.
 */
export type FundExitStats = {
  followerFinalUsd: number;
  followerReturnPct: number;
  spyFinalUsd: number;
  alphaUsd: number;
  alphaPct: number;
  winRate: number;
  avgReturnPct: number;
  medianReturnPct: number;
};

export type ConvictionPerFund = {
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
};

/**
 * A position the fund is STILL holding in their latest 13F, that has met
 * the conviction-hold threshold. This is the "actionable" idea list — a
 * follower could go open the same position today.
 */
export type CurrentPick = {
  fundCik: string;
  fundName: string;
  cusip: string;
  ticker: string;
  issuer: string;
  firstBuyDate: string;       // entry date of the current lifecycle (latest open trade)
  currentHoldDays: number;    // today - firstBuyDate (this lifecycle only)
  buyPrice: number;           // first lot's entry price
  todayPrice: number;
  returnPct: number;
  spyReturnPct: number;
  alphaPct: number;
};

export type ConvictionBucket = {
  minHoldQuarters: number;
  stats: ConvictionStats;
  /** "Hold to fund's actual exit" variant of the headline stats. */
  fundExitStats: FundExitStats;
  perFund: ConvictionPerFund[];
  topGainers: ConvictionSignal[];
  topLosers: ConvictionSignal[];
};

export type ConvictionBacktest = {
  positionSizeUsd: number;
  buckets: ConvictionBucket[];
  /**
   * All currently-held picks across every fund, sorted by current hold
   * duration (longest first). The client filters this array per-bucket by
   * `p.currentHoldDays >= minHoldQuarters * 90` — shipping it once instead
   * of materializing one filtered copy per bucket cuts the page payload
   * roughly 10x.
   */
  allCurrentPicks: CurrentPick[];
};

const todayIso = new Date().toISOString().slice(0, 10);
const todayUnix = isoToUnix(todayIso);

function _build(): ConvictionBacktest {
  // 1. Build a global ticker → today's price map (merged across all funds).
  const todayPriceByTicker: Record<string, number> = {};
  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) continue;
    for (const [tk, p] of Object.entries(snap.latestPriceByTicker ?? {})) {
      if (!(tk in todayPriceByTicker)) todayPriceByTicker[tk] = p;
    }
  }

  // 1b. Build the universe of CURRENTLY-HELD positions per fund. A position
  //     is "current" if the fund has at least one open trade for it; the
  //     trade's entryDate is the start of the current lifecycle.
  const allCurrentPicks: CurrentPick[] = [];
  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) continue;
    for (const t of snap.trades) {
      if (t.status !== "open" || !t.ticker || t.entrySharePrice <= 0) continue;
      const today = todayPriceByTicker[t.ticker];
      if (today == null || today <= 0) continue;
      const entryUnix = isoToUnix(t.entryDate);
      const currentHoldDays = (todayUnix - entryUnix) / 86400;
      const returnPct = (today / t.entrySharePrice - 1) * 100;
      const spyBuy = priceAt(SPY_BARS, entryUnix);
      const spyToday = SPY_BARS[SPY_BARS.length - 1]?.c;
      if (spyBuy == null || spyBuy <= 0 || spyToday == null || spyToday <= 0) {
        continue;
      }
      const spyReturnPct = (spyToday / spyBuy - 1) * 100;
      allCurrentPicks.push({
        fundCik: fund.cik,
        fundName: fund.displayName,
        cusip: t.cusip,
        ticker: t.ticker,
        issuer: t.issuer,
        firstBuyDate: t.entryDate,
        currentHoldDays,
        buyPrice: t.entrySharePrice,
        todayPrice: today,
        returnPct,
        spyReturnPct,
        alphaPct: returnPct - spyReturnPct,
      });
    }
  }

  // 2. Build per-(fund, cusip) hold-duration map.
  //    A position's "conviction" = earliest buy → latest sell (or today).
  type GroupKey = string; // `${fundCik}|${cusip}`
  type Group = {
    earliestBuyUnix: number;
    latestSellUnix: number;
  };
  const groups = new Map<GroupKey, Group>();
  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) continue;
    for (const s of snap.buySignals) {
      if (!s.ticker || s.buyPrice <= 0) continue;
      const key = `${fund.cik}|${s.cusip}`;
      const buyU = isoToUnix(s.buyDate);
      const sellU = s.sellDate ? isoToUnix(s.sellDate) : todayUnix;
      const g = groups.get(key);
      if (g) {
        if (buyU < g.earliestBuyUnix) g.earliestBuyUnix = buyU;
        if (sellU > g.latestSellUnix) g.latestSellUnix = sellU;
      } else {
        groups.set(key, { earliestBuyUnix: buyU, latestSellUnix: sellU });
      }
    }
  }

  // 3. Enrich every signal with today's price + the group's hold duration.
  const enriched: ConvictionSignal[] = [];
  for (const fund of MARQUEE_FUNDS) {
    const snap = getSnapshot(fund.cik);
    if (!snap) continue;
    for (const s of snap.buySignals) {
      if (!s.ticker || s.buyPrice <= 0) continue;
      const today = todayPriceByTicker[s.ticker];
      if (today == null || today <= 0) continue;

      const key = `${fund.cik}|${s.cusip}`;
      const g = groups.get(key);
      if (!g) continue;
      const positionHoldDays = (g.latestSellUnix - g.earliestBuyUnix) / 86400;

      const sharesBought = POSITION_SIZE_USD / s.buyPrice;
      const finalValueUsd = sharesBought * today;
      const pnlUsd = finalValueUsd - POSITION_SIZE_USD;
      const returnPct = (today / s.buyPrice - 1) * 100;

      const spyBuy = priceAt(SPY_BARS, isoToUnix(s.buyDate));
      const spyToday = SPY_BARS[SPY_BARS.length - 1]?.c;
      if (spyBuy == null || spyBuy <= 0 || spyToday == null || spyToday <= 0) {
        continue;
      }
      const spyReturnPct = (spyToday / spyBuy - 1) * 100;
      const spyFinalValueUsd = POSITION_SIZE_USD * (spyToday / spyBuy);
      const alphaUsd = finalValueUsd - spyFinalValueUsd;

      // Fund-exit-mode pricing: if the signal closed, use the snapshot's
      // sellPrice + sellDate; if still open, fall back to today.
      const fundExitPrice = s.sellPrice ?? today;
      const fundExitFinalValueUsd = sharesBought * fundExitPrice;
      const fundExitReturnPct = (fundExitPrice / s.buyPrice - 1) * 100;
      const fundExitSpyToday = s.sellDate
        ? (priceAt(SPY_BARS, isoToUnix(s.sellDate)) ?? spyToday)
        : spyToday;
      const spyFundExitFinalValueUsd =
        POSITION_SIZE_USD * (fundExitSpyToday / spyBuy);
      const fundExitAlphaUsd =
        fundExitFinalValueUsd - spyFundExitFinalValueUsd;

      enriched.push({
        fundCik: fund.cik,
        fundName: fund.displayName,
        cusip: s.cusip,
        ticker: s.ticker,
        issuer: s.issuer,
        buyDate: s.buyDate,
        buyPrice: s.buyPrice,
        todayPrice: today,
        positionHoldDays,
        returnPct,
        finalValueUsd,
        pnlUsd,
        spyBuyPrice: spyBuy,
        spyTodayPrice: spyToday,
        spyReturnPct,
        spyFinalValueUsd,
        alphaUsd,
        alphaPct: returnPct - spyReturnPct,
        fundExitPrice,
        fundExitFinalValueUsd,
        fundExitReturnPct,
        spyFundExitFinalValueUsd,
        fundExitAlphaUsd,
      });
    }
  }

  // 4. For each min-hold bucket, filter + aggregate.
  const buckets: ConvictionBucket[] = HOLD_QUARTER_BUCKETS.map(
    (minHoldQuarters) => {
      const minDays = minHoldQuarters * 90;
      const filtered = enriched.filter((s) => s.positionHoldDays >= minDays);

      const N = filtered.length;
      const totalInvested = N * POSITION_SIZE_USD;
      const followerFinal = filtered.reduce(
        (acc, e) => acc + e.finalValueUsd,
        0,
      );
      const spyFinal = filtered.reduce(
        (acc, e) => acc + e.spyFinalValueUsd,
        0,
      );
      const winners = filtered.filter((e) => e.alphaUsd > 0).length;
      const sumRet = filtered.reduce((acc, e) => acc + e.returnPct, 0);
      const sumHoldQ = filtered.reduce(
        (acc, e) => acc + e.positionHoldDays / 90,
        0,
      );
      const sortedRet = filtered.map((e) => e.returnPct).sort((a, b) => a - b);
      const medianReturnPct =
        sortedRet.length > 0 ? sortedRet[Math.floor(sortedRet.length / 2)] : 0;

      // Fund-exit-mode aggregates (alt sell convention — see FundExitStats).
      const feFollowerFinal = filtered.reduce(
        (acc, e) => acc + e.fundExitFinalValueUsd,
        0,
      );
      const feSpyFinal = filtered.reduce(
        (acc, e) => acc + e.spyFundExitFinalValueUsd,
        0,
      );
      const feWinners = filtered.filter((e) => e.fundExitAlphaUsd > 0).length;
      const feSumRet = filtered.reduce(
        (acc, e) => acc + e.fundExitReturnPct,
        0,
      );
      const feSortedRet = filtered
        .map((e) => e.fundExitReturnPct)
        .sort((a, b) => a - b);
      const feMedianRet =
        feSortedRet.length > 0
          ? feSortedRet[Math.floor(feSortedRet.length / 2)]
          : 0;
      const fundExitStats: FundExitStats = {
        followerFinalUsd: feFollowerFinal,
        followerReturnPct:
          totalInvested > 0
            ? ((feFollowerFinal - totalInvested) / totalInvested) * 100
            : 0,
        spyFinalUsd: feSpyFinal,
        alphaUsd: feFollowerFinal - feSpyFinal,
        alphaPct:
          totalInvested > 0
            ? ((feFollowerFinal - feSpyFinal) / totalInvested) * 100
            : 0,
        winRate: N > 0 ? feWinners / N : 0,
        avgReturnPct: N > 0 ? feSumRet / N : 0,
        medianReturnPct: feMedianRet,
      };

      const perFund: ConvictionPerFund[] = MARQUEE_FUNDS.map((fund) => {
        const fs = filtered.filter((e) => e.fundCik === fund.cik);
        const inv = fs.length * POSITION_SIZE_USD;
        const ff = fs.reduce((s, e) => s + e.finalValueUsd, 0);
        const sf = fs.reduce((s, e) => s + e.spyFinalValueUsd, 0);
        return {
          fundCik: fund.cik,
          fundName: fund.displayName,
          signals: fs.length,
          invested: inv,
          followerFinal: ff,
          spyFinal: sf,
          alphaUsd: ff - sf,
          followerReturnPct: inv > 0 ? ((ff - inv) / inv) * 100 : 0,
          spyReturnPct: inv > 0 ? ((sf - inv) / inv) * 100 : 0,
          alphaPct: inv > 0 ? ((ff - sf) / inv) * 100 : 0,
        };
      })
        .filter((f) => f.signals > 0)
        .sort((a, b) => b.alphaUsd - a.alphaUsd);

      const topGainers = [...filtered]
        .sort((a, b) => b.alphaUsd - a.alphaUsd)
        .slice(0, 10);
      const topLosers = [...filtered]
        .sort((a, b) => a.alphaUsd - b.alphaUsd)
        .slice(0, 10);

      return {
        minHoldQuarters,
        fundExitStats,
        stats: {
          minHoldQuarters,
          totalSignals: N,
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
          avgReturnPct: N > 0 ? sumRet / N : 0,
          medianReturnPct,
          avgHoldQuarters: N > 0 ? sumHoldQ / N : 0,
        },
        perFund,
        topGainers,
        topLosers,
      };
    },
  );

  // Sort once, on the way out — every bucket needs the same descending-hold
  // order; client-side filtering preserves that order.
  allCurrentPicks.sort((a, b) => b.currentHoldDays - a.currentHoldDays);

  return {
    positionSizeUsd: POSITION_SIZE_USD,
    buckets,
    allCurrentPicks,
  };
}

export const computeConvictionBacktest = cache(_build);
