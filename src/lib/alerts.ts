import type { FundBacktest, BacktestTrade } from "./backtest";

export type MaterialMove = {
  ticker: string;
  issuer: string;
  changeType: "new" | "exit" | "add" | "trim";
  valueUsd: number;
  changePercent?: number;
  fundName: string;
  cik: string;
  filingDate: string;
};

/**
 * Compare the two most recent filings for a fund and return material moves.
 *
 * Strategy: use entryDate on BacktestTrade as the filing date each position
 * was first reported. The two most recent distinct entryDates are Q(n) and
 * Q(n-1).
 *
 * - "new"  : ticker has entryDate == Q(n), meaning it opened in the latest filing
 * - "exit" : ticker closed (exitDate == Q(n)) — it was in Q(n-1) but gone in Q(n)
 * - "add"  : ticker is open in both quarters but Q(n).entryValueUsd > Q(n-1) * (1+pct)
 *            (we approximate the Q(n-1) value by finding any trade that was active
 *             in Q(n-1) for the same ticker)
 * - "trim" : same but value decreased by >= pct
 *
 * Only returns moves where valueUsd >= minValueUsd.
 */
export function detectMaterialMoves(
  backtest: FundBacktest,
  minValueUsd = 50_000_000,
  minChangePct = 0.3,
): MaterialMove[] {
  const { trades, cik, fundName } = backtest;

  // 1. Find the two most recent distinct filing dates (via entryDate).
  const allDates = Array.from(new Set(trades.map((t) => t.entryDate))).sort();
  if (allDates.length < 2) return [];

  const latestDate = allDates[allDates.length - 1];
  const prevDate = allDates[allDates.length - 2];

  // 2. Build a map of ticker → trade for each quarter.
  //    For Q(n): all trades that ENTERED on latestDate (new positions in latest filing)
  //    For Q(n-1): all trades that were ACTIVE during prevDate
  //      = entered on or before prevDate AND (not yet exited, OR exited after prevDate)

  const latestByTicker = new Map<string, BacktestTrade>();
  const prevByTicker = new Map<string, BacktestTrade>();

  for (const trade of trades) {
    const ticker = trade.ticker ?? trade.issuer;
    if (!ticker) continue;

    // A trade is "in latest filing" if it entered at latestDate (new open)
    if (trade.entryDate === latestDate) {
      latestByTicker.set(ticker, trade);
    }

    // A trade was "in prev filing" if it entered on or before prevDate
    // and had not yet exited before prevDate
    if (
      trade.entryDate <= prevDate &&
      (trade.exitDate === null || trade.exitDate > prevDate)
    ) {
      prevByTicker.set(ticker, trade);
    }
  }

  // Also include trades that entered before latestDate and are still open
  // (or exited at/after latestDate) — these represent continued positions in Q(n)
  const stillOpenInLatest = new Map<string, BacktestTrade>();
  for (const trade of trades) {
    const ticker = trade.ticker ?? trade.issuer;
    if (!ticker) continue;
    if (
      trade.entryDate < latestDate &&
      (trade.exitDate === null || trade.exitDate >= latestDate)
    ) {
      stillOpenInLatest.set(ticker, trade);
    }
  }

  const moves: MaterialMove[] = [];

  // 3. NEW positions: in latestDate but not in prev quarter at all
  for (const [ticker, trade] of latestByTicker) {
    if (prevByTicker.has(ticker)) continue; // not new
    const valueUsd = trade.entryValueUsd;
    if (valueUsd < minValueUsd) continue;
    moves.push({
      ticker,
      issuer: trade.issuer,
      changeType: "new",
      valueUsd,
      fundName,
      cik,
      filingDate: latestDate,
    });
  }

  // 4. EXIT positions: were in Q(n-1) but neither in latestByTicker nor stillOpenInLatest
  for (const [ticker, trade] of prevByTicker) {
    if (latestByTicker.has(ticker) || stillOpenInLatest.has(ticker)) continue;
    const valueUsd = trade.entryValueUsd;
    if (valueUsd < minValueUsd) continue;
    moves.push({
      ticker,
      issuer: trade.issuer,
      changeType: "exit",
      valueUsd,
      fundName,
      cik,
      filingDate: latestDate,
    });
  }

  // 5. ADD / TRIM: ticker exists in both Q(n-1) (via prevByTicker or stillOpenInLatest)
  //    and Q(n) (via stillOpenInLatest), value changed materially.
  //    We compare entryValueUsd of the latest-entered trade vs the prev trade.
  //    For open positions that span multiple quarters, the entryValueUsd is the
  //    original entry value — so we use the closest "prev" trade as baseline.
  for (const [ticker, prevTrade] of prevByTicker) {
    // Find the current representation of this position in Q(n)
    const currentTrade = stillOpenInLatest.get(ticker) ?? latestByTicker.get(ticker);
    if (!currentTrade) continue; // exited — handled above

    const prevValue = prevTrade.entryValueUsd;
    const currentValue = currentTrade.entryValueUsd;
    if (prevValue <= 0) continue;

    const changePct = (currentValue - prevValue) / prevValue;

    if (changePct >= minChangePct && currentValue >= minValueUsd) {
      moves.push({
        ticker,
        issuer: currentTrade.issuer,
        changeType: "add",
        valueUsd: currentValue,
        changePercent: changePct * 100,
        fundName,
        cik,
        filingDate: latestDate,
      });
    } else if (changePct <= -minChangePct && prevValue >= minValueUsd) {
      moves.push({
        ticker,
        issuer: currentTrade.issuer,
        changeType: "trim",
        valueUsd: currentValue,
        changePercent: changePct * 100,
        fundName,
        cik,
        filingDate: latestDate,
      });
    }
  }

  return moves;
}
