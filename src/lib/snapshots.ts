import { readFileSync } from "node:fs";
import path from "node:path";
import type { FundBacktest } from "./backtest";

// Each file in src/data/backtest/ is a pre-computed runBacktest() result for
// one marquee fund, refreshed weekly by scripts/generate-all-snapshots.ts and
// committed to git, so production reads them as static data instead of
// running the full backtest against SEC + Yahoo on every request.
//
// They're read from disk on first use rather than imported. Static JSON
// imports made Turbopack parse and bundle every snapshot into the server
// build, so build memory grew with the data until ~425 MB of JSON OOM-killed
// Vercel's 8 GB build machine. next.config.ts ships the directory with the
// server functions via outputFileTracingIncludes.
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "backtest");

const WIRED_CIKS = new Set<string>([
  "1067983", // Berkshire Hathaway
  "1336528", // Pershing Square
  "1167483", // Tiger Global
  "1037389", // Renaissance Technologies
  "1350694", // Bridgewater Associates
  "1423053", // Citadel Advisors
  "1029160", // Soros Fund Management
  "1656456", // Appaloosa
  "1179392", // Two Sigma Investments
  // UE-01 new funds (generated 2026-05-28). Concentrated activists / Tiger
  // Cubs / solos — full history, all validated ≥64% CUSIP coverage with
  // healthy (non-flat) equity curves.
  //
  // TWO of the 18 UE-01 funds are still NOT wired — they fall back to the
  // graceful "pending" state:
  //   • Trian (1345472) — pre-2012 13F filings aren't in the XML format
  //     the parser expects ("No information table XML found in filing"),
  //     so EVERY historical filing fails and the snapshot is 0 trades.
  //     This is a parser scope limitation, not a transient — a retry
  //     won't fix it. Wire it once the parser handles legacy 13Fs.
  //   • Starboard (1517137) — only 28% of CUSIPs map via the bundled seed
  //     (small-cap activist targets); too low to represent the book without
  //     an OpenFIGI key to expand the mapping.
  "1048445", // Elliott Management
  "1040273", // Third Point
  "1061165", // Lone Pine Capital
  "1135730", // Coatue Management
  "1103804", // Viking Global Investors
  "1747057", // D1 Capital Partners
  "1079114", // Greenlight Capital
  "1138995", // Glenview Capital
  "1649339", // Scion Asset Management
  "934639", // Maverick Capital
  "1159159", // JANA Partners
  "1536411", // Duquesne Family Office
  // Heavy quant books — snapshotMode "8q" in funds.ts, so the generator caps
  // them to 8 recent quarters to keep the Yahoo fetch volume (and the
  // snapshot size) manageable.
  "1009207", // D.E. Shaw
  "1167557", // AQR Capital Management
  "1273087", // Millennium Management
  "1603466", // Point72 Asset Management
]);

const cache = new Map<string, FundBacktest>();

export function getSnapshot(cik: string): FundBacktest | null {
  const cleanCik = cik.replace(/^0+/, "");
  if (!WIRED_CIKS.has(cleanCik)) return null;
  let snap = cache.get(cleanCik);
  if (!snap) {
    snap = JSON.parse(
      readFileSync(path.join(SNAPSHOT_DIR, `${cleanCik}.json`), "utf8"),
    ) as FundBacktest;
    cache.set(cleanCik, snap);
  }
  return snap;
}
