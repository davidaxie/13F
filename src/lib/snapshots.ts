import type { FundBacktest } from "./backtest";

// Static imports so Next.js bundles the JSON into the server build.
// Each file is a pre-computed runBacktest() result for one marquee fund;
// generated locally via /api/snapshot/[cik] and committed to git, so the
// production leaderboard reads them as static data instead of running the
// full backtest against SEC + Yahoo on every request.
import berkshire from "../data/backtest/1067983.json";
import pershing from "../data/backtest/1336528.json";
import tigerGlobal from "../data/backtest/1167483.json";
import renaissance from "../data/backtest/1037389.json";
import bridgewater from "../data/backtest/1350694.json";
import citadel from "../data/backtest/1423053.json";
import soros from "../data/backtest/1029160.json";
import appaloosa from "../data/backtest/1656456.json";
import twoSigma from "../data/backtest/1179392.json";

const SNAPSHOTS: Record<string, FundBacktest> = {
  "1067983": berkshire as unknown as FundBacktest,
  "1336528": pershing as unknown as FundBacktest,
  "1167483": tigerGlobal as unknown as FundBacktest,
  "1037389": renaissance as unknown as FundBacktest,
  "1350694": bridgewater as unknown as FundBacktest,
  "1423053": citadel as unknown as FundBacktest,
  "1029160": soros as unknown as FundBacktest,
  "1656456": appaloosa as unknown as FundBacktest,
  "1179392": twoSigma as unknown as FundBacktest,
};

export function getSnapshot(cik: string): FundBacktest | null {
  const cleanCik = cik.replace(/^0+/, "");
  return SNAPSHOTS[cleanCik] ?? null;
}
