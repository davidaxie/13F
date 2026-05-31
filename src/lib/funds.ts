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

// How much a *new position* from this kind of firm actually tells a
// long-horizon investor. The thesis: a concentrated value or activist book
// opening a name is a deliberate, multi-year bet — high signal. A quant /
// market-making platform (Citadel, Renaissance, AQR, Millennium) "opening" a
// name is mostly mechanical, high-turnover flow — near-meaningless as a
// long-term thesis even when the dollar amount is huge. Used to rank and tier
// the /entries page so the noise sinks to the bottom.
export type SignalTier = "high" | "medium" | "low" | "noise";

export const STYLE_SIGNAL_TIER: Record<FundStyle, SignalTier> = {
  value: "high",
  activist: "high",
  tigerCub: "medium",
  macro: "low",
  quant: "noise",
};

export const SIGNAL_TIER_META: Record<
  SignalTier,
  { rank: number; label: string; blurb: string }
> = {
  high: {
    rank: 0,
    label: "High-conviction · long horizon",
    blurb:
      "Concentrated value & activist books. A new position is a deliberate, multi-year bet — the strongest single-name signal here.",
  },
  medium: {
    rank: 1,
    label: "Fundamental growth",
    blurb:
      "Tiger-lineage long/short. Research-driven, but larger books and higher turnover dilute what any one entry means.",
  },
  low: {
    rank: 2,
    label: "Macro · thematic",
    blurb:
      "Top-down books that rotate fast and often express views via ETFs. A single-name entry is a weak standalone signal.",
  },
  noise: {
    rank: 3,
    label: "Systematic · market-making",
    blurb:
      "Quant & multi-strat platforms. Entries are mechanical, high-turnover flow — near-meaningless for a long-horizon thesis no matter how large. Shown for completeness, downranked by design.",
  },
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
  /**
   * Snapshot history coverage for this fund.
   * - "all" (default): backtest snapshot covers full available history.
   * - "8q": only the last 8 quarters are captured. Used for heavy quant
   *   books where the Yahoo fetch volume across full history would be
   *   prohibitive. Pre-snapshotStartDate entries simply don't exist —
   *   "first disclosure" in the snapshot is NOT the fund's first-ever
   *   buy, just the first one we have data for.
   */
  snapshotMode?: "all" | "8q";
  /**
   * For 8Q-mode funds: the ISO date (YYYY-MM or YYYY-MM-DD) marking the
   * start of the snapshot window. Used for UI annotations like
   * "First disclosed Q3 2024 (8Q snapshot)".
   */
  snapshotStartDate?: string;
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
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
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
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
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
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
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
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
  },
  // --- New funds added in UE-01 ---
  {
    cik: "1048445",
    displayName: "Elliott Management",
    style: "activist",
    tagline:
      "Paul Singer's multi-strategy activist franchise — known for aggressive public campaigns, sovereign-debt arbitrage, and forcing M&A or board changes.",
    founded: "1977",
    headquarters: "New York, NY",
    manager: "Paul Singer · Jonathan Pollock",
    aumApprox: "~$65B",
  },
  {
    cik: "1040273",
    displayName: "Third Point",
    style: "activist",
    tagline:
      "Dan Loeb's activist/event-driven fund. Concentrates in 15–25 positions with vocal public theses across equities and credit.",
    founded: "1995",
    headquarters: "New York, NY",
    manager: "Dan Loeb",
    aumApprox: "~$12B",
  },
  {
    cik: "1061165",
    displayName: "Lone Pine Capital",
    style: "tigerCub",
    tagline:
      "Steve Mandel's Tiger Cub — long-biased growth with a global mandate. One of the most respected fundamental long/short books.",
    founded: "1997",
    headquarters: "Greenwich, CT",
    manager: "Steve Mandel (founder) · Kelly Granat (CIO)",
    aumApprox: "~$15B",
  },
  {
    cik: "1135730",
    displayName: "Coatue Management",
    style: "tigerCub",
    tagline:
      "Philippe Laffont's Tiger Cub specializing in technology and internet. Known for large concentrated tech bets and a private crossover sleeve.",
    founded: "1999",
    headquarters: "New York, NY",
    manager: "Philippe Laffont",
    aumApprox: "~$50B public + private",
  },
  {
    cik: "1103804",
    displayName: "Viking Global Investors",
    style: "tigerCub",
    tagline:
      "Andreas Halvorsen's flagship Tiger Cub. Deep-fundamental long/short with a global equity mandate — one of the largest Tiger-lineage funds.",
    founded: "1999",
    headquarters: "Stamford, CT",
    manager: "Andreas Halvorsen",
    aumApprox: "~$45B",
  },
  {
    cik: "1747057",
    displayName: "D1 Capital Partners",
    style: "tigerCub",
    tagline:
      "Dan Sundheim's multi-stage fund blending public long/short equities with private venture positions — a next-generation Tiger Cub.",
    founded: "2018",
    headquarters: "New York, NY",
    manager: "Dan Sundheim",
    aumApprox: "~$20B",
  },
  {
    cik: "1079114",
    displayName: "Greenlight Capital",
    style: "value",
    tagline:
      "David Einhorn's value-oriented long/short fund. Known for high-conviction short theses, deep fundamental analysis, and contrarian positioning.",
    founded: "1996",
    headquarters: "New York, NY",
    manager: "David Einhorn",
    aumApprox: "~$2B",
  },
  {
    cik: "1138995",
    displayName: "Glenview Capital",
    style: "value",
    tagline:
      "Larry Robbins' healthcare-focused value fund. Concentrates in large-cap healthcare, managed care, and biopharma with long investment horizons.",
    founded: "2000",
    headquarters: "New York, NY",
    manager: "Larry Robbins",
    aumApprox: "~$8B",
  },
  {
    cik: "1009207",
    displayName: "D.E. Shaw",
    style: "quant",
    tagline:
      "David Shaw-founded quantitative powerhouse. The 13F captures their long equity book; the full firm employs systematic strategies across every asset class.",
    founded: "1988",
    headquarters: "New York, NY",
    manager: "David Shaw (founder) · Max Stone",
    aumApprox: "~$60B",
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
  },
  {
    cik: "1167557",
    displayName: "AQR Capital Management",
    style: "quant",
    tagline:
      "Cliff Asness-founded quant shop running factor-based strategies. The 13F is one of the largest long-equity disclosures in the industry.",
    founded: "1998",
    headquarters: "Greenwich, CT",
    manager: "Cliff Asness",
    aumApprox: "~$120B firm AUM",
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
  },
  {
    cik: "1273087",
    displayName: "Millennium Management",
    style: "quant",
    tagline:
      "Izzy Englander's multi-manager platform. 13F reflects the aggregate of hundreds of pods — massive diversification, high turnover.",
    founded: "1989",
    headquarters: "New York, NY",
    manager: "Izzy Englander",
    aumApprox: "~$70B",
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
  },
  {
    cik: "1649339",
    displayName: "Scion Asset Management",
    style: "value",
    tagline:
      "Michael Burry's concentrated value fund. Famous for the 2008 subprime short; now runs a small, eclectic book of contrarian long positions.",
    founded: "2013 (re-launched)",
    headquarters: "Saratoga, CA",
    manager: "Michael Burry",
    aumApprox: "~$300M",
  },
  {
    cik: "934639",
    displayName: "Maverick Capital",
    style: "tigerCub",
    tagline:
      "Lee Ainslie's Tiger Cub with a global long/short equity mandate. Multi-sector fundamental approach with deep sector expertise.",
    founded: "1993",
    headquarters: "Dallas, TX",
    manager: "Lee Ainslie",
    aumApprox: "~$10B",
  },
  {
    cik: "1345472",
    displayName: "Trian Fund Management",
    style: "activist",
    tagline:
      "Nelson Peltz's operational activist fund. Takes large stakes and pushes for cost cuts, M&A, or strategic pivots — long holding periods.",
    founded: "2005",
    headquarters: "New York, NY",
    manager: "Nelson Peltz · Ed Garden",
    aumApprox: "~$8B",
  },
  {
    cik: "1517137",
    displayName: "Starboard Value",
    style: "activist",
    tagline:
      "Jeff Smith's activist shop targeting underperforming small- and mid-cap companies. Known for detailed operational improvement plans.",
    founded: "2011",
    headquarters: "New York, NY",
    manager: "Jeff Smith",
    aumApprox: "~$8B",
  },
  {
    cik: "1159159",
    displayName: "JANA Partners",
    style: "activist",
    tagline:
      "Barry Rosenstein's activist fund known for engineering M&A transactions and strategic reviews at undervalued companies.",
    founded: "2001",
    headquarters: "New York, NY",
    manager: "Barry Rosenstein",
    aumApprox: "~$3B",
  },
  {
    cik: "1536411",
    displayName: "Duquesne Family Office",
    style: "macro",
    tagline:
      "Stanley Druckenmiller's family office — successor to Duquesne Capital. Concentrated macro-informed equity book with long-term compounding orientation.",
    founded: "2010 (family office)",
    headquarters: "New York, NY",
    manager: "Stanley Druckenmiller",
    aumApprox: "~$3B family office",
  },
  {
    cik: "1603466",
    displayName: "Point72 Asset Management",
    style: "quant",
    tagline:
      "Steve Cohen's multi-manager platform rebuilt from SAC Capital. Combines fundamental L/S pods with systematic strategies.",
    founded: "2014",
    headquarters: "Stamford, CT",
    manager: "Steve Cohen",
    aumApprox: "~$35B",
    snapshotMode: "8q",
    snapshotStartDate: "2024-08",
  },
];
