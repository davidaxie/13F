import type { FundBacktest } from "./backtest";

export type MaterialMove = {
  ticker: string;
  issuer: string;
  changeType: "new" | "exit" | "add";
  valueUsd: number;
  changePercent?: number;
  fundName: string;
  cik: string;
  filingDate: string;
};

/**
 * Detect the material moves in a fund's most-recent 13F filing.
 *
 * IMPORTANT — what the snapshot data model can and can't express:
 *   • `trades` track a position's full open→close lifecycle with a SINGLE
 *     `entryValueUsd` (value at open). They do NOT carry per-quarter share
 *     counts, so you cannot diff a continuing position quarter-over-quarter
 *     from `trades` alone (comparing a trade to itself is always 0%).
 *   • `buySignals` capture every quarter a fund OPENED or ADDED to a
 *     position (sharesAdded > 0). They do NOT capture share decreases.
 *
 * So this function derives:
 *   • "new"  — a position whose first-ever appearance is the latest filing
 *              (from `trades`).
 *   • "exit" — a trade whose exitDate is the latest filing (from `trades`).
 *   • "add"  — a buy signal dated the latest filing for a position that
 *              already existed (from `buySignals`).
 *   • "trim" — NOT detectable from the snapshot (no per-quarter share
 *              decreases are stored). Intentionally omitted rather than
 *              faked. If trims matter, the snapshot needs per-filing share
 *              counts (a future data-model change).
 *
 * The "latest filing date" is the max of every entry/exit/buy/sell date in
 * the snapshot, so a filing that only exited or added still registers.
 *
 * Only returns moves where valueUsd >= minValueUsd.
 */
export function detectMaterialMoves(
  backtest: FundBacktest,
  minValueUsd = 50_000_000,
): MaterialMove[] {
  const { trades, buySignals, cik, fundName } = backtest;

  // 1. The latest filing date = the most recent date ANYTHING happened
  //    (open, exit, add, or sell), not just the most recent open.
  const dateSet = new Set<string>();
  for (const t of trades) {
    dateSet.add(t.entryDate);
    if (t.exitDate) dateSet.add(t.exitDate);
  }
  for (const s of buySignals) {
    dateSet.add(s.buyDate);
    if (s.sellDate) dateSet.add(s.sellDate);
  }
  const sorted = Array.from(dateSet).sort();
  if (sorted.length < 2) return [];
  const latestDate = sorted[sorted.length - 1];

  // 2. First-ever entry date per CUSIP — distinguishes a brand-new position
  //    from a re-entry / add of an existing one.
  const firstEntryByCusip = new Map<string, string>();
  for (const t of trades) {
    const cur = firstEntryByCusip.get(t.cusip);
    if (!cur || t.entryDate < cur) firstEntryByCusip.set(t.cusip, t.entryDate);
  }

  const moves: MaterialMove[] = [];
  const seen = new Set<string>(); // dedup by `${changeType}:${cusip}`

  function push(m: MaterialMove, cusip: string) {
    const key = `${m.changeType}:${cusip}`;
    if (seen.has(key)) return;
    seen.add(key);
    moves.push(m);
  }

  // 3. NEW: a trade entering at the latest filing whose CUSIP has no earlier
  //    appearance (truly first-ever, not a re-entry).
  for (const t of trades) {
    if (t.entryDate !== latestDate) continue;
    if (firstEntryByCusip.get(t.cusip) !== latestDate) continue;
    if (t.entryValueUsd < minValueUsd) continue;
    push(
      {
        ticker: t.ticker ?? t.issuer,
        issuer: t.issuer,
        changeType: "new",
        valueUsd: t.entryValueUsd,
        fundName,
        cik,
        filingDate: latestDate,
      },
      t.cusip,
    );
  }

  // 4. EXIT: a trade closed at the latest filing.
  for (const t of trades) {
    if (t.exitDate !== latestDate) continue;
    if (t.entryValueUsd < minValueUsd) continue;
    push(
      {
        ticker: t.ticker ?? t.issuer,
        issuer: t.issuer,
        changeType: "exit",
        valueUsd: t.entryValueUsd,
        fundName,
        cik,
        filingDate: latestDate,
      },
      t.cusip,
    );
  }

  // 5. ADD: a buy signal at the latest filing for a position that already
  //    existed before this filing (so it's an add, not a new open).
  for (const s of buySignals) {
    if (s.buyDate !== latestDate) continue;
    if (!s.ticker || s.buyPrice <= 0) continue;
    if (firstEntryByCusip.get(s.cusip) === latestDate) continue; // first-ever → counted as "new"
    const addValue = s.sharesAdded * s.buyPrice;
    if (addValue < minValueUsd) continue;
    push(
      {
        ticker: s.ticker,
        issuer: s.issuer,
        changeType: "add",
        valueUsd: addValue,
        fundName,
        cik,
        filingDate: latestDate,
      },
      s.cusip,
    );
  }

  return moves;
}
