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

// Share-class separator varies by source: S&P uses ".", Yahoo uses "-",
// Bloomberg uses "/", SEC's company_tickers.json sometimes drops the
// separator entirely. Mirrors the variant generator in cusip-lookup.ts so
// /stock/BRK.B routes through to the same issuer record as BRK-B / BRKB.
function tickerVariants(input: string): string[] {
  const upper = input.trim().toUpperCase();
  const variants = new Set<string>([upper]);
  variants.add(upper.replace(/[.\-/]/g, ""));
  variants.add(upper.replace(/[.\-/]/g, "."));
  variants.add(upper.replace(/[.\-/]/g, "-"));
  variants.add(upper.replace(/[.\-/]/g, "/"));
  return Array.from(variants);
}

/**
 * Look up a company's SEC CIK by its ticker symbol. Used to fetch
 * issuer-keyed EDGAR filings (Form 4 insider transactions, 13D/G filed
 * against the company, etc.).
 *
 * Source: SEC's company_tickers.json (~10K public US issuers, refreshed
 * via scripts/build-company-tickers.ts).
 *
 * Tries the input as given, plus normalized variants (BRK.B → BRK-B → BRKB)
 * so the issuer-side fetches (Insider, Fundamentals, Recent SEC filings)
 * resolve regardless of which separator the URL or upstream source used.
 */
export function cikForTicker(
  ticker: string | null | undefined,
): { cik: string; name: string } | null {
  if (!ticker) return null;
  for (const v of tickerVariants(ticker)) {
    const hit = COMPANY_TICKERS[v];
    if (hit) return hit;
  }
  return null;
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
