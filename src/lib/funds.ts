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
  /** One-line tagline rendered in the fund header. */
  tagline?: string;
  /** Founded year for the firm (not the principal). */
  founded?: string;
  /** Headquarters city. */
  headquarters?: string;
  /** Notable manager / founder(s). */
  manager?: string;
  /** Approximate AUM, descriptive (e.g. "$300B+ equity book"). */
  aumApprox?: string;
};

export const MARQUEE_FUNDS: MarqueeFund[] = [
  {
    cik: "1067983",
    displayName: "Berkshire Hathaway",
    style: "value",
    tagline:
      "Buffett's concentrated, decades-long-horizon value book. Bank, energy, consumer-staples staples + the AAPL position.",
    founded: "1839 (textile); Buffett control 1965",
    headquarters: "Omaha, NE",
    manager: "Warren Buffett · Todd Combs · Ted Weschler",
    aumApprox: "$300B+ equity book",
  },
  {
    cik: "1336528",
    displayName: "Pershing Square",
    style: "activist",
    tagline:
      "Ackman's concentrated activist book. Famously 8–12 names, multi-year holds, vocal public theses.",
    founded: "2004",
    headquarters: "New York, NY",
    manager: "Bill Ackman",
    aumApprox: "~$15B",
  },
  {
    cik: "1167483",
    displayName: "Tiger Global",
    style: "tigerCub",
    tagline:
      "Chase Coleman's growth / tech / internet long book — the canonical Tiger Cub, with a private-side venture franchise alongside.",
    founded: "2001",
    headquarters: "New York, NY",
    manager: "Chase Coleman · Scott Shleifer",
    aumApprox: "~$30B public equities",
  },
  {
    cik: "1037389",
    displayName: "Renaissance Technologies",
    style: "quant",
    tagline:
      "Simons-founded systematic fund. The 13F reflects their Institutional Equities (RIEF/RIDA) sleeve — a fraction of the firm's total book.",
    founded: "1982",
    headquarters: "East Setauket, NY",
    manager: "Peter Brown (CEO, post-Simons)",
    aumApprox: "~$60B (long-only sleeve)",
  },
  {
    cik: "1350694",
    displayName: "Bridgewater Associates",
    style: "macro",
    tagline:
      "Dalio-founded macro/risk-parity fund. The 13F is a sliver of their book — mostly ETF positioning + a small single-name overlay.",
    founded: "1975",
    headquarters: "Westport, CT",
    manager: "Nir Bar Dea (CEO)",
    aumApprox: "~$140B firm AUM",
  },
  {
    cik: "1423053",
    displayName: "Citadel Advisors",
    style: "quant",
    tagline:
      "Griffin's multi-strategy giant. 13F reflects equities-pod positioning — heavy turnover, broad diversification.",
    founded: "1990",
    headquarters: "Miami, FL",
    manager: "Ken Griffin",
    aumApprox: "$60B+ multi-strat",
  },
  {
    cik: "1029160",
    displayName: "Soros Fund Management",
    style: "macro",
    tagline:
      "Family office (Soros' fund closed to outsiders in 2011). Eclectic positioning across themes.",
    founded: "1969",
    headquarters: "New York, NY",
    manager: "Dawn Fitzpatrick (CIO)",
    aumApprox: "~$25B family office",
  },
  {
    cik: "1656456",
    displayName: "Appaloosa",
    style: "value",
    tagline:
      "Tepper's distressed / opportunistic value shop. Now run as a family office; aggressive concentrated bets.",
    founded: "1993",
    headquarters: "Miami Beach, FL",
    manager: "David Tepper",
    aumApprox: "~$15B family office",
  },
  {
    cik: "1179392",
    displayName: "Two Sigma Investments",
    style: "quant",
    tagline:
      "Siegel/Overdeck-founded systematic fund. 13F captures the long-equity-factor sleeve of a much larger multi-strat book.",
    founded: "2001",
    headquarters: "New York, NY",
    manager: "John Overdeck · David Siegel",
    aumApprox: "~$60B firm AUM",
  },
];
