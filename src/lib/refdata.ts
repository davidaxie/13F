// Reference-data lookup. For now: GICS sector + sub-industry per ticker,
// scraped from S&P 500 / 400 / 600 constituents (see
// scripts/build-gics.ts). Future expansion: market cap, shares outstanding,
// ETF/ADR classification.
//
// The bundled JSON is committed under src/data/gics.json. Re-run the build
// script to refresh.

import gicsData from "../data/gics.json";
import companyTickerData from "../data/company-tickers.json";
import { tickerForCusip } from "./cusip-lookup";

export type GicsRow = { sector: string; industry: string };

const GICS = gicsData as Record<string, GicsRow>;
const COMPANY_TICKERS = companyTickerData as Record<string, { cik: string; name: string }>;

/**
 * Look up GICS sector + industry by ticker. Returns null if the ticker
 * isn't in the S&P 1500 universe (e.g. ADRs, micro-caps, foreign primary
 * listings, private placements).
 */
export function getSectorByTicker(ticker: string | null | undefined): GicsRow | null {
  if (!ticker) return null;
  return GICS[ticker.toUpperCase()] ?? null;
}

/**
 * Look up GICS sector + industry by CUSIP. Goes through the cusip→ticker
 * reverse index first, then the ticker→GICS map.
 */
export function getSectorByCusip(cusip: string | null | undefined): GicsRow | null {
  if (!cusip) return null;
  const ticker = tickerForCusip(cusip);
  return ticker ? getSectorByTicker(ticker) : null;
}

/**
 * Coverage stats — useful for debugging / display ("N of M holdings tagged").
 */
export function getGicsCoverage(): {
  totalTickers: number;
  sectorCounts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  for (const v of Object.values(GICS)) {
    counts[v.sector] = (counts[v.sector] ?? 0) + 1;
  }
  return { totalTickers: Object.keys(GICS).length, sectorCounts: counts };
}

/**
 * Look up a company's SEC CIK by its ticker symbol. Used to fetch
 * issuer-keyed EDGAR filings (Form 4 insider transactions, 13D/G filed
 * against the company, etc.).
 *
 * Source: SEC's company_tickers.json (~10K public US issuers, refreshed
 * via scripts/build-company-tickers.ts).
 */
export function cikForTicker(
  ticker: string | null | undefined,
): { cik: string; name: string } | null {
  if (!ticker) return null;
  return COMPANY_TICKERS[ticker.toUpperCase()] ?? null;
}

/**
 * The 11 GICS Level-1 sectors. Useful for filter UIs / heatmap axes.
 */
export const GICS_SECTORS = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
] as const;
