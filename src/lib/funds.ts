// Pure-data module — safe to import from BOTH client and server components.
// Keep this file free of any Node-only imports (fs, edgar fetch, etc.) so
// adding "use client" components that need the marquee list doesn't drag
// disk-cache / SEC code into the browser bundle.

// Style tags for cohort filtering. Coarse buckets — most multi-strategy
// funds blur lines (Citadel runs quant + L/S + macro pods), but a single
// dominant tag is enough for the dashboard filter to be useful.
export type FundStyle = "value" | "activist" | "tigerCub" | "quant" | "macro";

export const FUND_STYLE_LABELS: Record<FundStyle, string> = {
  value: "Value",
  activist: "Activist",
  tigerCub: "Tiger Cub",
  quant: "Quant",
  macro: "Macro",
};

export type MarqueeFund = {
  cik: string;
  displayName: string;
  style: FundStyle;
};

export const MARQUEE_FUNDS: MarqueeFund[] = [
  { cik: "1067983", displayName: "Berkshire Hathaway", style: "value" },
  { cik: "1336528", displayName: "Pershing Square", style: "activist" },
  { cik: "1167483", displayName: "Tiger Global", style: "tigerCub" },
  { cik: "1037389", displayName: "Renaissance Technologies", style: "quant" },
  { cik: "1350694", displayName: "Bridgewater Associates", style: "macro" },
  { cik: "1423053", displayName: "Citadel Advisors", style: "quant" },
  { cik: "1029160", displayName: "Soros Fund Management", style: "macro" },
  { cik: "1656456", displayName: "Appaloosa", style: "value" },
  { cik: "1179392", displayName: "Two Sigma Investments", style: "quant" },
];
