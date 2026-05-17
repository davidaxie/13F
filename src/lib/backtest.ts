import { cache } from "react";
import {
  getFundInfo,
  getHoldings,
  isValueInThousands,
  type Filing,
} from "./edgar";
import type { Holding } from "./parse-13f";
import { lookupCusips, type CusipMapping } from "./openfigi";
import { getPriceHistory, priceAt, isoToUnix, type Bar } from "./prices";

export type BacktestTrade = {
  cusip: string;
  ticker: string | null;
  issuer: string;
  entryAccession: string;
  entryDate: string;
  exitAccession: string | null;
  exitDate: string | null;
  entrySharePrice: number;
  exitSharePrice: number | null;
  entryValueUsd: number;
  shares: number;
  returnPct: number;
  pnlUsd: number;
  status: "closed" | "open";
};

export type EquityCurvePoint = {
  date: string;
  mirror: number;
  spy: number;
};

export type PnlPoint = {
  date: string;
  cumulative: number;
  trade: BacktestTrade;
};

export type FundBacktest = {
  cik: string;
  fundName: string;
  startDate: string;
  endDate: string;
  startingCash: number;
  trades: BacktestTrade[];
  equityCurve: EquityCurvePoint[];
  pnlSeries: PnlPoint[];
  filingCount: number;
  mappedCusipCount: number;
  unmappedCusipCount: number;
  stats: {
    mirrorFinal: number;
    spyFinal: number;
    mirrorReturnPct: number;
    spyReturnPct: number;
    alphaPct: number;
    maxDrawdownPct: number;
    realizedPnlUsd: number;
    closedTrades: number;
    openTrades: number;
    winRate: number;
    avgReturnPct: number;
    bestTrade: BacktestTrade | null;
    worstTrade: BacktestTrade | null;
  };
};

function toDollars(value: number, filingDate: string): number {
  return isValueInThousands(filingDate) ? value * 1000 : value;
}

type AggPos = {
  cusip: string;
  issuer: string;
  titleOfClass: string;
  putCall?: string;
  value: number; // raw, not converted to dollars
  shares: number;
};

function aggregateByCusip(rows: Holding[]): Map<string, AggPos> {
  const map = new Map<string, AggPos>();
  for (const r of rows) {
    if (!r.cusip) continue;
    // Exclude options (puts/calls) — only mirror common stock holdings.
    if (r.putCall) continue;
    const existing = map.get(r.cusip);
    if (existing) {
      existing.value += r.value;
      existing.shares += r.shares;
    } else {
      map.set(r.cusip, {
        cusip: r.cusip,
        issuer: r.issuer,
        titleOfClass: r.titleOfClass,
        putCall: r.putCall,
        value: r.value,
        shares: r.shares,
      });
    }
  }
  return map;
}

async function pMap<T, R>(
  items: T[],
  fn: (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

type FilingWithPositions = {
  filing: Filing;
  positions: Map<string, AggPos>;
  filingUnix: number;
};

async function _runBacktest(
  cik: string,
  fundName: string,
  startingCash: number,
  mode: "recent" | "all",
  maxQuarters?: number,
): Promise<FundBacktest> {
  const cleanCik = cik.replace(/^0+/, "");

  // 1. Fetch every 13F filing for this fund.
  const info = await getFundInfo(cleanCik, mode);
  const allFilings = info.filings
    .filter((f) => f.filingDate && f.reportDate)
    // Treat the same period twice (HR + HR/A) by keeping only the latest filing per quarter.
    .reverse() // chronological
    .reduce<Filing[]>((acc, f) => {
      const last = acc[acc.length - 1];
      if (last && last.reportDate === f.reportDate) {
        acc[acc.length - 1] = f;
      } else {
        acc.push(f);
      }
      return acc;
    }, [])
    // Optionally cap to most recent N quarters so backtests fit serverless
    // function timeouts (Vercel Hobby = 60s).
    .slice(maxQuarters && maxQuarters > 0 ? -maxQuarters : 0);

  // 2. Pull holdings for each filing concurrently.
  const holdingsByAccession = await pMap(
    allFilings,
    (f) =>
      getHoldings(cleanCik, f.accessionNumber).catch((err) => {
        console.warn(
          `backtest: holdings fetch failed for ${cleanCik}/${f.accessionNumber}: ${err instanceof Error ? err.message : err}`,
        );
        return [] as Holding[];
      }),
    5,
  );

  const filingsWithPositions: FilingWithPositions[] = allFilings
    .map((f, i) => ({
      filing: f,
      positions: aggregateByCusip(holdingsByAccession[i]),
      filingUnix: isoToUnix(f.filingDate),
    }))
    .filter((fp) => fp.positions.size > 0);

  if (filingsWithPositions.length === 0) {
    return emptyBacktest(cleanCik, fundName, startingCash);
  }

  // 3. Collect every unique CUSIP that ever appeared.
  const cusipSet = new Set<string>();
  for (const fp of filingsWithPositions) {
    for (const c of fp.positions.keys()) cusipSet.add(c);
  }

  // 4. Resolve CUSIP -> ticker.
  const cusipToMapping: Map<string, CusipMapping> = await lookupCusips(cusipSet);

  // 5. Fetch price history for every mapped ticker + SPY.
  const tickers = new Set<string>(["SPY"]);
  for (const m of cusipToMapping.values()) {
    if (m.ticker) tickers.add(m.ticker);
  }
  const earliestFilingDate = filingsWithPositions[0].filing.filingDate;
  const tickersArr = Array.from(tickers);
  const priceLists = await pMap(
    tickersArr,
    (t) => getPriceHistory(t, earliestFilingDate),
    4,
  );
  const pricesByTicker = new Map<string, Bar[]>();
  for (let i = 0; i < tickersArr.length; i++) {
    pricesByTicker.set(tickersArr[i], priceLists[i]);
  }
  const spyBars = pricesByTicker.get("SPY") ?? [];

  const tickerOf = (cusip: string): string | null => {
    return cusipToMapping.get(cusip)?.ticker ?? null;
  };

  let mappedCount = 0;
  let unmappedCount = 0;
  for (const c of cusipSet) {
    if (cusipToMapping.get(c)?.ticker) mappedCount++;
    else unmappedCount++;
  }

  // 6. Extract trades: each CUSIP's run from first appearance to first absence.
  const trades: BacktestTrade[] = [];
  const openByCusip = new Map<string, BacktestTrade>();

  for (let i = 0; i < filingsWithPositions.length; i++) {
    const fp = filingsWithPositions[i];
    const filingUnix = fp.filingUnix;
    const present = fp.positions;

    // Close trades whose CUSIP is no longer reported.
    for (const [cusip, trade] of Array.from(openByCusip.entries())) {
      if (present.has(cusip)) continue;
      const tk = trade.ticker;
      const bars = tk ? (pricesByTicker.get(tk) ?? []) : [];
      const exitPrice = priceAt(bars, filingUnix);
      if (exitPrice != null && trade.entrySharePrice > 0) {
        trade.exitDate = fp.filing.filingDate;
        trade.exitAccession = fp.filing.accessionNumber;
        trade.exitSharePrice = exitPrice;
        trade.returnPct = (exitPrice / trade.entrySharePrice - 1) * 100;
        trade.pnlUsd = trade.entryValueUsd * (trade.returnPct / 100);
        trade.status = "closed";
        trades.push(trade);
      } else {
        // Couldn't price the exit — still close the trade conceptually but with no return.
        trade.exitDate = fp.filing.filingDate;
        trade.exitAccession = fp.filing.accessionNumber;
        trade.status = "closed";
        trades.push(trade);
      }
      openByCusip.delete(cusip);
    }

    // Open new trades for CUSIPs not yet tracked.
    for (const [cusip, pos] of present) {
      if (openByCusip.has(cusip)) continue;
      const tk = tickerOf(cusip);
      const valueUsd = toDollars(pos.value, fp.filing.filingDate);
      const entryPrice = tk
        ? priceAt(pricesByTicker.get(tk) ?? [], filingUnix)
        : null;
      const trade: BacktestTrade = {
        cusip,
        ticker: tk,
        issuer: pos.issuer,
        entryAccession: fp.filing.accessionNumber,
        entryDate: fp.filing.filingDate,
        exitAccession: null,
        exitDate: null,
        entrySharePrice: entryPrice ?? 0,
        exitSharePrice: null,
        entryValueUsd: valueUsd,
        shares: pos.shares,
        returnPct: 0,
        pnlUsd: 0,
        status: "open",
      };
      openByCusip.set(cusip, trade);
    }
  }

  // Mark open trades to market using the most recent price.
  for (const trade of openByCusip.values()) {
    const tk = trade.ticker;
    if (tk && trade.entrySharePrice > 0) {
      const bars = pricesByTicker.get(tk) ?? [];
      const latest = bars.length > 0 ? bars[bars.length - 1].c : null;
      if (latest != null) {
        trade.exitSharePrice = latest;
        trade.returnPct = (latest / trade.entrySharePrice - 1) * 100;
        trade.pnlUsd = trade.entryValueUsd * (trade.returnPct / 100);
      }
    }
    trades.push(trade);
  }

  // 7. Equity curve: at each filing, rebalance to fund weights. Between filings,
  //    hold the same shares; daily value tracks daily prices. Sample weekly.
  const SAMPLE_DAYS = 7;
  const ONE_DAY = 86400;
  const startUnix = filingsWithPositions[0].filingUnix;
  const todayUnix = Math.floor(Date.now() / 1000);

  // SPY benchmark: buy at start, hold to today.
  const spyStartPrice = priceAt(spyBars, startUnix);
  const spyShares = spyStartPrice ? startingCash / spyStartPrice : 0;

  let myShares = new Map<string, number>(); // ticker -> shares
  let filingIdx = 0;

  const equityCurve: EquityCurvePoint[] = [];

  function rebalanceAt(fp: FilingWithPositions) {
    const filingUnix = fp.filingUnix;
    // Mark current portfolio to value using filing-date prices.
    let portValue = 0;
    if (filingIdx === 0 && myShares.size === 0) {
      portValue = startingCash;
    } else {
      for (const [ticker, shares] of myShares) {
        const p = priceAt(pricesByTicker.get(ticker) ?? [], filingUnix);
        if (p != null) portValue += shares * p;
      }
      if (portValue === 0) portValue = startingCash;
    }

    // Build the fund's weight map using filing-date prices, restricted to
    // CUSIPs we can actually mirror (mapped + priced).
    const fundDollarsByTicker = new Map<string, number>();
    let fundTotalDollars = 0;
    for (const [cusip, pos] of fp.positions) {
      const tk = tickerOf(cusip);
      if (!tk) continue;
      const p = priceAt(pricesByTicker.get(tk) ?? [], filingUnix);
      if (p == null || p <= 0) continue;
      const dollars = pos.shares * p;
      fundDollarsByTicker.set(tk, (fundDollarsByTicker.get(tk) ?? 0) + dollars);
      fundTotalDollars += dollars;
    }

    const nextShares = new Map<string, number>();
    if (fundTotalDollars > 0) {
      for (const [tk, dollars] of fundDollarsByTicker) {
        const weight = dollars / fundTotalDollars;
        const targetValue = portValue * weight;
        const p = priceAt(pricesByTicker.get(tk) ?? [], filingUnix);
        if (p != null && p > 0) {
          nextShares.set(tk, targetValue / p);
        }
      }
    }
    myShares = nextShares;
  }

  // Walk the timeline.
  for (let t = startUnix; t <= todayUnix; t += SAMPLE_DAYS * ONE_DAY) {
    while (
      filingIdx < filingsWithPositions.length &&
      filingsWithPositions[filingIdx].filingUnix <= t
    ) {
      rebalanceAt(filingsWithPositions[filingIdx]);
      filingIdx++;
    }
    let mirror = 0;
    for (const [tk, shares] of myShares) {
      const p = priceAt(pricesByTicker.get(tk) ?? [], t);
      if (p != null) mirror += shares * p;
    }
    if (mirror === 0) mirror = startingCash;

    const spyPrice = priceAt(spyBars, t);
    const spy = spyPrice != null ? spyShares * spyPrice : startingCash;

    equityCurve.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      mirror,
      spy,
    });
  }
  // Always append "today" so the chart ends precisely on the latest data.
  if (
    equityCurve.length > 0 &&
    new Date(equityCurve[equityCurve.length - 1].date).getTime() / 1000 <
      todayUnix - 0.5 * ONE_DAY
  ) {
    while (
      filingIdx < filingsWithPositions.length &&
      filingsWithPositions[filingIdx].filingUnix <= todayUnix
    ) {
      rebalanceAt(filingsWithPositions[filingIdx]);
      filingIdx++;
    }
    let mirror = 0;
    for (const [tk, shares] of myShares) {
      const p = priceAt(pricesByTicker.get(tk) ?? [], todayUnix);
      if (p != null) mirror += shares * p;
    }
    if (mirror === 0) mirror = startingCash;
    const spyPrice = priceAt(spyBars, todayUnix);
    const spy = spyPrice != null ? spyShares * spyPrice : startingCash;
    equityCurve.push({
      date: new Date(todayUnix * 1000).toISOString().slice(0, 10),
      mirror,
      spy,
    });
  }

  // 8. P&L series — cumulative realized P&L across closed trades, in $.
  const closedTrades = trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => (a.exitDate ?? "").localeCompare(b.exitDate ?? ""));
  let cum = 0;
  const pnlSeries: PnlPoint[] = [];
  for (const tr of closedTrades) {
    cum += tr.pnlUsd ?? 0;
    pnlSeries.push({ date: tr.exitDate ?? tr.entryDate, cumulative: cum, trade: tr });
  }

  // 9. Stats.
  const mirrorFinal = equityCurve[equityCurve.length - 1]?.mirror ?? startingCash;
  const spyFinal = equityCurve[equityCurve.length - 1]?.spy ?? startingCash;

  let peak = startingCash;
  let maxDD = 0;
  for (const p of equityCurve) {
    if (p.mirror > peak) peak = p.mirror;
    const dd = (p.mirror - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  const winners = closedTrades.filter((t) => t.returnPct > 0).length;
  const sumPct = closedTrades.reduce((s, t) => s + t.returnPct, 0);
  const best = closedTrades.length > 0
    ? closedTrades.reduce((a, b) => (a.returnPct > b.returnPct ? a : b))
    : null;
  const worst = closedTrades.length > 0
    ? closedTrades.reduce((a, b) => (a.returnPct < b.returnPct ? a : b))
    : null;

  return {
    cik: cleanCik,
    fundName,
    startDate: filingsWithPositions[0].filing.filingDate,
    endDate: equityCurve[equityCurve.length - 1]?.date ?? earliestFilingDate,
    startingCash,
    trades,
    equityCurve,
    pnlSeries,
    filingCount: filingsWithPositions.length,
    mappedCusipCount: mappedCount,
    unmappedCusipCount: unmappedCount,
    stats: {
      mirrorFinal,
      spyFinal,
      mirrorReturnPct: (mirrorFinal / startingCash - 1) * 100,
      spyReturnPct: (spyFinal / startingCash - 1) * 100,
      alphaPct: ((mirrorFinal - spyFinal) / startingCash) * 100,
      maxDrawdownPct: maxDD * 100,
      realizedPnlUsd: cum,
      closedTrades: closedTrades.length,
      openTrades: trades.length - closedTrades.length,
      winRate: closedTrades.length > 0 ? winners / closedTrades.length : 0,
      avgReturnPct: closedTrades.length > 0 ? sumPct / closedTrades.length : 0,
      bestTrade: best,
      worstTrade: worst,
    },
  };
}

function emptyBacktest(
  cik: string,
  fundName: string,
  startingCash: number,
): FundBacktest {
  const today = new Date().toISOString().slice(0, 10);
  return {
    cik,
    fundName,
    startDate: today,
    endDate: today,
    startingCash,
    trades: [],
    equityCurve: [],
    pnlSeries: [],
    filingCount: 0,
    mappedCusipCount: 0,
    unmappedCusipCount: 0,
    stats: {
      mirrorFinal: startingCash,
      spyFinal: startingCash,
      mirrorReturnPct: 0,
      spyReturnPct: 0,
      alphaPct: 0,
      maxDrawdownPct: 0,
      realizedPnlUsd: 0,
      closedTrades: 0,
      openTrades: 0,
      winRate: 0,
      avgReturnPct: 0,
      bestTrade: null,
      worstTrade: null,
    },
  };
}

// On Vercel we cap to the most recent 12 quarters (~3 years) so the 9-fund
// leaderboard finishes inside Hobby's 60s function timeout on a cold
// container. Locally we use the full history (disk-cached) since we're
// not bounded.
const DEFAULT_MAX_QUARTERS = process.env.VERCEL ? 12 : 0;

export const runBacktest = cache(
  async (
    cik: string,
    fundName: string,
    startingCash = 10000,
    mode: "recent" | "all" = "all",
    maxQuarters: number = DEFAULT_MAX_QUARTERS,
  ): Promise<FundBacktest> => {
    return _runBacktest(cik, fundName, startingCash, mode, maxQuarters);
  },
);
